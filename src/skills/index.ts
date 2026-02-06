// TODO: Hot-reload skills on SKILL.md change
// TODO: Skill enable/disable

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import type { Skill } from './types.js';
import { loadConfig } from '../config.js';
import { getTools } from '../tools/index.js';

const SKILLS_DIR = join(process.cwd(), 'skills');

function loadSkill(name: string): Skill | null {
  const mdPath = join(SKILLS_DIR, name, 'SKILL.md');
  if (!existsSync(mdPath)) return null;

  const content = readFileSync(mdPath, 'utf-8');
  const config = loadConfig();
  const skillConfig = config.skills[name];
  const modelRef = skillConfig?.model || 'local-fast';

  // Default: all tools. Analyzer narrows this down later.
  const tools = getTools();

  // Parse description from ## Description header
  const descMatch = content.match(/^## Description\n(.+?)(?:\n##|\n\n|$)/ms);
  const description = descMatch?.[1]?.trim() || name;

  return { name, description, modelRef, systemPrompt: content, tools };
}

export function loadAllSkills(): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  if (!existsSync(SKILLS_DIR)) return skills;

  for (const entry of readdirSync(SKILLS_DIR)) {
    const full = join(SKILLS_DIR, entry);
    if (!statSync(full).isDirectory()) continue;
    const skill = loadSkill(entry);
    console.log(skill);
    if (skill) skills.set(skill.name, skill);
  }
  return skills;
}

/** Concise summary for orchestrator context */
export function getSkillsSummary(skills: Map<string, Skill>): string {
  if (skills.size === 0) return 'No skills available.';
  const lines: string[] = [];
  for (const [name, skill] of skills) {
    const toolNames = Object.keys(skill.tools).join(', ');
    lines.push(`- ${name} (model: ${skill.modelRef}): ${skill.description || name} [tools: ${toolNames}]`);
  }
  return lines.join('\n');
}
