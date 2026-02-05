import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { glob } from 'glob';
import type { Skill, ModelConfig, Tool } from './types.js';
import { loadConfig, resolveModelConfig } from './config.js';

const SKILLS_DIR = join(process.cwd(), 'skills');

/**
 * Parses a SKILL.md file into a Skill object
 */
function parseSkillMarkdown(content: string, skillName: string): Partial<Skill> {
  const skill: Partial<Skill> = {
    name: skillName,
    rawContent: content,
    triggers: [],
    tools: [],
    executionPattern: [],
  };

  // Extract description (first paragraph after title)
  const descMatch = content.match(/^#\s+.+?\n\n(.+?)(?:\n\n|$)/s);
  if (descMatch) {
    skill.description = descMatch[1].trim();
  }

  // Extract triggers section
  const triggersMatch = content.match(/##\s*Triggers?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (triggersMatch) {
    const triggers = triggersMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    skill.triggers = triggers;
  }

  // Extract model configuration
  const modelMatch = content.match(/##\s*Model\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (modelMatch) {
    const modelSection = modelMatch[1].trim();

    // Check for "Uses: model-name" syntax (this is a reference to a named model in config)
    const usesMatch = modelSection.match(/Uses:\s*(\S+)/i);
    if (usesMatch) {
      // Store as string reference to be resolved later via config
      skill.model = usesMatch[1] as unknown as ModelConfig;
    }

    // Check for explicit provider/model (inline definition)
    const providerMatch = modelSection.match(/provider:\s*(\S+)/i);
    const modelNameMatch = modelSection.match(/model:\s*(\S+)/i);
    if (providerMatch && modelNameMatch) {
      skill.model = {
        provider: providerMatch[1] as 'openrouter' | 'ollama',
        model: modelNameMatch[1],
      };
    }
  }

  // Extract tools section
  const toolsMatch = content.match(/##\s*Tools?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (toolsMatch) {
    const tools = toolsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    skill.tools = tools;
  }

  // Extract execution pattern
  const patternMatch = content.match(/##\s*Execution\s*Pattern?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (patternMatch) {
    const patterns = patternMatch[1]
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    skill.executionPattern = patterns;
  }

  return skill;
}

/**
 * Loads custom tools from a skill's tools.ts file
 */
async function loadCustomTools(skillDir: string): Promise<Record<string, Tool> | undefined> {
  const toolsPath = join(skillDir, 'tools.ts');

  if (!existsSync(toolsPath)) {
    return undefined;
  }

  try {
    // Dynamic import for the tools module
    const module = await import(toolsPath);
    return module.tools || module.default?.tools;
  } catch (error) {
    console.warn(`Failed to load custom tools from ${toolsPath}:`, error);
    return undefined;
  }
}

/**
 * Loads a single skill from its directory
 */
export async function loadSkill(skillDir: string): Promise<Skill | null> {
  const skillPath = join(skillDir, 'SKILL.md');
  const skillName = basename(skillDir);

  if (!existsSync(skillPath)) {
    console.warn(`No SKILL.md found in ${skillDir}`);
    return null;
  }

  try {
    const content = readFileSync(skillPath, 'utf-8');
    const parsed = parseSkillMarkdown(content, skillName);
    const customTools = await loadCustomTools(skillDir);

    // Resolve model configuration
    const config = loadConfig();
    let modelConfig: ModelConfig;

    if (parsed.model) {
      // SKILL.md has explicit model config
      if (typeof parsed.model === 'string') {
        modelConfig = resolveModelConfig(parsed.model, config);
      } else {
        modelConfig = parsed.model;
      }
    } else if (config.skills[skillName]?.model) {
      // Use config.yaml skill-specific setting
      modelConfig = resolveModelConfig(config.skills[skillName].model, config);
    } else {
      // Fall back to local-fast
      modelConfig = resolveModelConfig('local-fast', config);
    }

    return {
      name: skillName,
      description: parsed.description || `${skillName} skill`,
      triggers: parsed.triggers || [],
      model: modelConfig,
      tools: parsed.tools || [],
      executionPattern: parsed.executionPattern || [],
      rawContent: content,
      customTools,
    };
  } catch (error) {
    console.error(`Error loading skill from ${skillDir}:`, error);
    return null;
  }
}

/**
 * Discovers and loads all skills from the skills directory
 */
export async function loadAllSkills(): Promise<Map<string, Skill>> {
  const skills = new Map<string, Skill>();
  console.log('Loading skills from', SKILLS_DIR);

  if (!existsSync(SKILLS_DIR)) {
    console.warn('No skills directory found');
    return skills;
  }

  // Find all SKILL.md files
  const skillFiles = await glob('*/SKILL.md', { cwd: SKILLS_DIR });

  for (const skillFile of skillFiles) {
    const skillDir = join(SKILLS_DIR, dirname(skillFile));
    const skill = await loadSkill(skillDir);

    if (skill) {
      skills.set(skill.name, skill);
    }
  }

  return skills;
}

/**
 * Gets a summary of all loaded skills (for orchestrator context)
 */
export function getSkillsSummary(skills: Map<string, Skill>): string {
  if (skills.size === 0) {
    return 'No skills available.';
  }

  const lines = ['Available skills:'];

  for (const [name, skill] of skills) {
    lines.push(`\n## ${name}`);
    lines.push(skill.description);

    if (skill.triggers.length > 0) {
      lines.push(`Triggers: ${skill.triggers.join(', ')}`);
    }

    if (skill.tools.length > 0) {
      lines.push(`Tools: ${skill.tools.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Finds skills that match a given query (for orchestrator routing)
 */
export function findMatchingSkills(query: string, skills: Map<string, Skill>): Skill[] {
  const queryLower = query.toLowerCase();
  const matches: Skill[] = [];

  for (const skill of skills.values()) {
    // Check name
    if (skill.name.toLowerCase().includes(queryLower)) {
      matches.push(skill);
      continue;
    }

    // Check triggers
    for (const trigger of skill.triggers) {
      if (trigger.toLowerCase().includes(queryLower) ||
          queryLower.includes(trigger.toLowerCase())) {
        matches.push(skill);
        break;
      }
    }

    // Check description
    if (skill.description.toLowerCase().includes(queryLower)) {
      if (!matches.includes(skill)) {
        matches.push(skill);
      }
    }
  }

  return matches;
}
