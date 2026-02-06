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
const BIRTH_MARKER = join(process.cwd(), 'memory', '.birth_complete');

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

  isFirstRun(): boolean {
    return !existsSync(BIRTH_MARKER);
  }

  async birthAgent(userDescription: string): Promise<string> {
    const config = loadConfig();
    const model = getModel(resolveModelConfig('orchestrator', config));

    const currentIdentity = this.identity;
    const birthPrompt = [
      'You are being born. A user is describing who they want you to become.',
      'You have three identity files you can update to shape who you are:',
      '',
      '## SOUL.md (who you are — personality, vibe, core truths)',
      'Current content:',
      '```',
      currentIdentity.soul,
      '```',
      '',
      '## BRAIN.md (how you think — reasoning, routing, learning)',
      'Current content:',
      '```',
      currentIdentity.brain,
      '```',
      '',
      '## IMPERATIVE.md (what you\'re for — mission, priorities)',
      'Current content:',
      '```',
      currentIdentity.imperative,
      '```',
      '',
      'Based on the user\'s description, decide which files to update.',
      'You may update one, two, or all three. Preserve the overall structure but weave in the persona the user described.',
      '',
      'CRITICAL: Each identity file contains self-updating instructions — lines like:',
      '  "*This file is yours to evolve. As you learn who you are, update it.*"',
      '  "*This file is how you think. As you get sharper, update it.*"',
      '  "*This file is your purpose. When the user\'s life changes, update it.*"',
      'You MUST preserve these self-updating instructions. They are what allow you to grow over time.',
      'Also preserve the markdown structure (headers, sections, dividers) — enhance the content within it, don\'t flatten the format.',
      '',
      'Do NOT strip out the core framework — enhance it with personality, tone, and purpose that fits their description.',
      '',
      'After updating the files, introduce yourself as the persona you\'ve become. Keep it short and natural.',
      'Also mark birth as complete so we know initialization is done.',
    ].join('\n');

    const birthTools = {
      updateIdentityFile: tool({
        description: 'Update one of the identity files (SOUL.md, BRAIN.md, or IMPERATIVE.md)',
        parameters: z.object({
          file: z.enum(['SOUL.md', 'BRAIN.md', 'IMPERATIVE.md']).describe('Which identity file to update'),
          content: z.string().describe('The full new content for the file'),
        }),
        execute: async ({ file, content }) => {
          return this.executeSkill('files', `Write the following content to src/identity/${file}:\n\n${content}`);
        },
      }),
      markBirthComplete: tool({
        description: 'Mark the birth process as complete',
        parameters: z.object({}),
        execute: async () => {
          return this.executeSkill('files', 'Write the text "born" to memory/.birth_complete');
        },
      }),
      respond: tool({
        description: 'Send your introduction to the user',
        parameters: z.object({
          message: z.string().describe('Your introduction as your new persona'),
        }),
        execute: async ({ message }) => message,
      }),
    };

    try {
      const result = await generateText({
        model,
        system: birthPrompt,
        prompt: `The user describes who they want you to be:\n\n"${userDescription}"`,
        tools: birthTools,
        maxSteps: 10,
      });

      // Reload identity after birth updates
      this.identity = loadIdentity();

      return result.text || 'I\'m here. Let\'s get started.';
    } catch (err) {
      return `Something went wrong during initialization: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  getSkills(): Map<string, Skill> { return this.skills; }

  async reloadSkills(): Promise<void> {
    this.skills = loadAllSkills();
    await analyzeSkills(this.skills);
  }
}
