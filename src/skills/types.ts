// TODO: Skill versioning
// TODO: Skill dependencies (skill X requires skill Y)

import type { Tool } from 'ai';

export interface Skill {
  name: string;
  description: string;       // parsed from ## Description header
  modelRef: string;          // key in config.models (e.g. "local-code")
  systemPrompt: string;      // full SKILL.md content
  tools: Record<string, Tool>; // assigned primitives
}
