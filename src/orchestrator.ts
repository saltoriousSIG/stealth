// TODO: Parallel skill execution for independent steps
// TODO: Stream responses
// TODO: Cost tracking

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Identity, SkillResult } from './types.js';
import type { Skill } from './skills/types.js';
import { loadConfig, resolveModelConfig } from './config.js';
import { getModel } from './providers/index.js';
import { loadAllSkills, getSkillsSummary } from './skills/index.js';
import { analyzeSkills } from './skills/analyzer.js';
import { generateMissingTools } from './skills/generator.js';
import { loadGeneratedTools } from './tools/index.js';
import { addMessage, getRecentMessages } from './memory.js';

const IDENTITY_DIR = join(process.cwd(), 'src', 'identity');

function loadIdentity(): Identity {
  const load = (name: string) => {
    const p = join(IDENTITY_DIR, name);
    return existsSync(p) ? readFileSync(p, 'utf-8') : '';
  };
  return { soul: load('SOUL.md'), brain: load('BRAIN.md'), imperative: load('IMPERATIVE.md') };
}

function buildSystemPrompt(identity: Identity, skillsSummary: string): string {
  return [
    identity.soul, identity.brain, identity.imperative,
    '', '# Available Skills', skillsSummary,
    '', '# Instructions',
    'You are the orchestrator. For each user message:',
    '1. If you can answer directly, use respondDirectly.',
    '2. If the task needs a specialist, use delegateToSkill with clear instructions.',
    '3. You may delegate multiple times for multi-step tasks.',
  ].join('\n');
}

export class Orchestrator {
  private identity: Identity = { soul: '', brain: '', imperative: '' };
  private skills: Map<string, Skill> = new Map();

  async init(): Promise<void> {
    this.identity = loadIdentity();
    await loadGeneratedTools();
    this.skills = loadAllSkills();
    await analyzeSkills(this.skills);
    await generateMissingTools(this.skills);
  }

  private async executeSkill(skillName: string, instructions: string): Promise<SkillResult> {
    const skill = this.skills.get(skillName);
    if (!skill) return { success: false, response: '', error: `Unknown skill: ${skillName}` };

    try {
      const config = loadConfig();
      const model = getModel(resolveModelConfig(skill.modelRef, config));

      const result = await generateText({
        model,
        system: skill.systemPrompt,
        prompt: instructions,
        tools: skill.tools,
        maxSteps: 10,
      });

      return { success: true, response: result.text };
    } catch (err) {
      return { success: false, response: '', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async process(userMessage: string): Promise<string> {
    addMessage({ role: 'user', content: userMessage });

    const config = loadConfig();
    const model = getModel(resolveModelConfig('orchestrator', config));
    const systemPrompt = buildSystemPrompt(this.identity, getSkillsSummary(this.skills));

    const recent = getRecentMessages(6);
    const historyStr = recent.map(m => `${m.role}: ${m.content}`).join('\n');

    const orchestratorTools = {
      delegateToSkill: tool({
        description: 'Delegate a task to a specialized skill',
        parameters: z.object({
          skill: z.string().describe('Skill name'),
          instructions: z.string().describe('Detailed instructions for the skill'),
        }),
        execute: async ({ skill, instructions }) => {
          const result = await this.executeSkill(skill, instructions);
          return result.success ? result.response : `Error: ${result.error}`;
        },
      }),
      respondDirectly: tool({
        description: 'Respond directly to the user without delegation',
        parameters: z.object({
          message: z.string().describe('The response message'),
        }),
        execute: async ({ message }) => message,
      }),
    };

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: historyStr ? `Recent conversation:\n${historyStr}\n\nUser: ${userMessage}` : userMessage,
        tools: orchestratorTools,
        maxSteps: 5,
      });

      const response = result.text || 'I was unable to generate a response.';
      addMessage({ role: 'assistant', content: response });
      return response;
    } catch (err) {
      const msg = `Error: ${err instanceof Error ? err.message : String(err)}`;
      addMessage({ role: 'assistant', content: msg });
      return msg;
    }
  }

  getSkills(): Map<string, Skill> { return this.skills; }

  async reloadSkills(): Promise<void> {
    this.skills = loadAllSkills();
    await analyzeSkills(this.skills);
  }
}
