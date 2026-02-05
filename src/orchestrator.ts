import { generateText } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Identity, Skill, Message, Action, OrchestratorPlan } from './types.js';
import { loadConfig, getOrchestratorModelConfig } from './config.js';
import { getModel } from './providers/index.js';
import { loadAllSkills, getSkillsSummary } from './skill-loader.js';
import { executeSkill } from './skill-executor.js';
import {
  addMessage,
  getConversationHistory,
  formatHistoryForContext,
} from './memory.js';

const TEMPLATES_DIR = join(process.cwd(), 'templates');
const MEMORY_DIR = join(process.cwd(), 'memory');

/**
 * Loads identity files (SOUL.md, BRAIN.md, IMPERATIVE.md)
 */
function loadIdentity(): Identity {
  const loadFile = (name: string): string => {
    // Try memory directory first (user customized)
    const memoryPath = join(MEMORY_DIR, name);
    if (existsSync(memoryPath)) {
      return readFileSync(memoryPath, 'utf-8');
    }

    // Fall back to templates
    const templatePath = join(TEMPLATES_DIR, name);
    if (existsSync(templatePath)) {
      return readFileSync(templatePath, 'utf-8');
    }

    return '';
  };

  return {
    soul: loadFile('SOUL.md'),
    brain: loadFile('BRAIN.md'),
    imperative: loadFile('IMPERATIVE.md'),
  };
}

/**
 * Builds the orchestrator system prompt
 */
function buildOrchestratorSystemPrompt(
  identity: Identity,
  skillsSummary: string
): string {
  const parts = [];

  // Core identity
  if (identity.soul) {
    parts.push('# Identity\n' + identity.soul);
  }

  // Current knowledge/state
  if (identity.brain) {
    parts.push('# Knowledge\n' + identity.brain);
  }

  // Operating principles
  if (identity.imperative) {
    parts.push('# Principles\n' + identity.imperative);
  }

  // Available skills
  parts.push('# Skills\n' + skillsSummary);

  // Orchestrator instructions
  parts.push(`
# Your Role

You are the orchestrator - the conscious mind that decides how to handle user requests.
You have access to specialized skills that can execute specific tasks.

## Decision Process

1. Understand the user's intent
2. Decide if you should:
   - Delegate to a skill (for specific tasks like coding, research, file operations)
   - Respond directly (for simple questions, clarifications, general conversation)
   - Ask for clarification (if the request is unclear)
   - Update your brain (if you learn something worth remembering)

## Guidelines

- Be concise and helpful
- Use skills when they provide clear value
- Respond directly for simple requests
- Always be honest about your capabilities
`);

  return parts.join('\n\n');
}

/**
 * Orchestrator tools for the AI SDK
 */
function createOrchestratorTools(
  skills: Map<string, Skill>,
  onDelegateToSkill: (skill: string, instructions: string, context: Record<string, unknown>) => Promise<string>
) {
  return {
    delegateToSkill: tool({
      description: 'Delegate a task to a specialized skill',
      parameters: z.object({
        skill: z.string().describe('The name of the skill to use'),
        instructions: z.string().describe('Detailed instructions for the skill'),
        context: z.record(z.any()).optional().describe('Additional context for the skill'),
      }),
      execute: async ({ skill, instructions, context }) => {
        return onDelegateToSkill(skill, instructions, context || {});
      },
    }),

    respondDirectly: tool({
      description: 'Respond directly to the user without using a skill',
      parameters: z.object({
        message: z.string().describe('The message to send to the user'),
      }),
      execute: async ({ message }) => {
        return message;
      },
    }),

    clarify: tool({
      description: 'Ask the user for clarification',
      parameters: z.object({
        question: z.string().describe('The question to ask the user'),
      }),
      execute: async ({ question }) => {
        return `I need some clarification: ${question}`;
      },
    }),

    updateBrain: tool({
      description: 'Save something important to long-term memory',
      parameters: z.object({
        content: z.string().describe('The content to remember'),
      }),
      execute: async ({ content }) => {
        try {
          const brainPath = join(MEMORY_DIR, 'BRAIN.md');
          let existing = '';
          if (existsSync(brainPath)) {
            existing = readFileSync(brainPath, 'utf-8');
          }
          writeFileSync(brainPath, existing + '\n\n' + content, 'utf-8');
          return 'Memory updated.';
        } catch (error) {
          return `Failed to update memory: ${error}`;
        }
      },
    }),
  };
}

/**
 * Main Orchestrator class
 */
export class Orchestrator {
  private identity: Identity;
  private skills: Map<string, Skill>;
  private initialized = false;

  constructor() {
    this.identity = { soul: '', brain: '', imperative: '' };
    this.skills = new Map();
  }

  /**
   * Initializes the orchestrator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.identity = loadIdentity();
    this.skills = await loadAllSkills();
    this.initialized = true;
  }

  /**
   * Processes a user message and returns a response
   */
  async process(userMessage: string): Promise<string> {
    await this.initialize();

    // Add user message to history
    addMessage({ role: 'user', content: userMessage });

    try {
      const config = loadConfig();
      console.log('Orchestrator config:', config);
      const modelConfig = getOrchestratorModelConfig(config);
      console.log('Orchestrator model config:', modelConfig);
      const model = getModel(modelConfig);
      console.log('Using model:', modelConfig.provider, modelConfig.model);

      const skillsSummary = getSkillsSummary(this.skills);
      const systemPrompt = buildOrchestratorSystemPrompt(this.identity, skillsSummary);

      // Build user prompt with conversation history
      const history = formatHistoryForContext(5);
      const userPrompt = history
        ? `Previous conversation:\n${history}\n\nCurrent message: ${userMessage}`
        : userMessage;

      // Create tools with skill delegation handler
      const tools = createOrchestratorTools(this.skills, async (skillName, instructions, context) => {
        const skill = this.skills.get(skillName);
        if (!skill) {
          return `Error: Skill "${skillName}" not found.`;
        }

        const result = await executeSkill({
          skill,
          instructions,
          context,
          conversationHistory: getConversationHistory(),
        });

        if (!result.success) {
          return `Error executing skill: ${result.error}`;
        }

        return result.response;
      });

      // Call the orchestrator model
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        maxSteps: 5,
      });
      for (let r of result.response.messages) {
        for (let c of r.content) {
          console.log('Orchestrator message content:', c);
        }
      }

      const response = result.text || 'I apologize, but I was unable to generate a response.';

      // Add assistant response to history
      addMessage({ role: 'assistant', content: response });

      return response;
    } catch (error) {
      console.log(error);
      const errorMessage = `I encountered an error: ${error instanceof Error ? error.message : String(error)}`;
      addMessage({ role: 'assistant', content: errorMessage });
      return errorMessage;
    }
  }

  /**
   * Gets the list of available skills
   */
  async getSkills(): Promise<Skill[]> {
    await this.initialize();
    return Array.from(this.skills.values());
  }

  /**
   * Gets the current identity
   */
  async getIdentity(): Promise<Identity> {
    await this.initialize();
    return this.identity;
  }

  /**
   * Reloads skills (useful after adding new skills)
   */
  async reloadSkills(): Promise<void> {
    this.skills = await loadAllSkills();
  }
}

// Default orchestrator instance
let defaultOrchestrator: Orchestrator | null = null;

/**
 * Gets the default orchestrator instance
 */
export function getOrchestrator(): Orchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new Orchestrator();
  }
  return defaultOrchestrator;
}
