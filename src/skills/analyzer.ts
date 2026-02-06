// TODO: Invalidate when tool inventory changes
// TODO: Re-analyze when SKILL.md content changes

import { generateText } from 'ai';
import type { Skill } from './types.js';
import { loadConfig, resolveModelConfig } from '../config.js';
import { getModel } from '../providers/index.js';
import { getTools, listToolNames, getSkillToolMap, saveSkillToolMap } from '../tools/index.js';

/** Analyze skills and assign tools. Uses manifest cache when available. */
export async function analyzeSkills(skills: Map<string, Skill>): Promise<void> {
  const cached = getSkillToolMap();
  const availableTools = listToolNames();
  const updatedMap: Record<string, string[]> = { ...cached };
  let needsSave = false;

  for (const [name, skill] of skills) {
    // Use cached mapping if it exists
    if (cached[name]) {
      skill.tools = getTools(cached[name]);
      continue;
    }
    console.log(name, 'needs analysis');
    console.log(skill, "skills");
    console.log(availableTools, "available tools");

    // No cache — ask LLM
    try {
      const config = loadConfig();
      const model = getModel(resolveModelConfig('orchestrator', config));

      const result = await generateText({
        model,
        prompt: `Given this skill and available tools, return ONLY a JSON array of tool names this skill needs.

Skill: ${name}
${skill.systemPrompt}

Available tools: ${availableTools.join(', ')}

Return: ["tool1", "tool2"]
If a needed tool doesn't exist, prefix with "NEW:" like "NEW:toolName".`,
        maxTokens: 256,
      });
      console.log(result);

      const parsed = JSON.parse(result.text.trim());
      if (!Array.isArray(parsed)) continue;

      const existing = parsed.filter((t: string) => !t.startsWith('NEW:'));
      const missing = parsed.filter((t: string) => t.startsWith('NEW:')).map((t: string) => t.replace('NEW:', ''));

      skill.tools = getTools(existing);
      updatedMap[name] = existing;
      needsSave = true;

      if (missing.length > 0) {
        (skill as any)._missingTools = missing;
      }
    } catch (err) {
      console.warn(`Failed to analyze "${name}", keeping all tools:`, err);
    }
  }

  if (needsSave) saveSkillToolMap(updatedMap);
}
