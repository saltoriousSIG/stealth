import { generateText } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import type { Skill, SkillExecutionContext, SkillResult, Tool, Message } from './types.js';
import { getModel } from './providers/index.js';
import { getTools, registerTools, toAISDKTools } from './tools/index.js';

/**
 * Builds the system prompt for a skill execution
 */
function buildSkillSystemPrompt(skill: Skill): string {
  const lines = [
    `You are executing the "${skill.name}" skill.`,
    '',
    skill.description,
    '',
  ];

  if (skill.executionPattern.length > 0) {
    lines.push('## Execution Pattern');
    skill.executionPattern.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');
  }

  lines.push('## Guidelines');
  lines.push('- Use the available tools to accomplish the task');
  lines.push('- Be concise and focused on the specific task');
  lines.push('- Report any errors clearly');

  return lines.join('\n');
}

/**
 * Builds the user prompt for a skill execution
 */
function buildSkillUserPrompt(
  instructions: string,
  context: Record<string, unknown>
): string {
  const lines = ['## Instructions', instructions];

  if (Object.keys(context).length > 0) {
    lines.push('', '## Context');
    for (const [key, value] of Object.entries(context)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Converts our Tool type to Vercel AI SDK tool format
 */
function convertToolsToAISDK(tools: Tool[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const t of tools) {
    // Build zod schema from parameters
    const properties: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(t.parameters.properties)) {
      let schema: z.ZodTypeAny;

      switch (prop.type) {
        case 'string':
          schema = z.string().describe(prop.description);
          break;
        case 'number':
          schema = z.number().describe(prop.description);
          break;
        case 'boolean':
          schema = z.boolean().describe(prop.description);
          break;
        default:
          schema = z.any().describe(prop.description);
      }

      // Make optional if not required
      if (!t.parameters.required?.includes(key)) {
        schema = schema.optional();
      }

      properties[key] = schema;
    }

    result[t.name] = tool({
      description: t.description,
      parameters: z.object(properties),
      execute: async (params: Record<string, unknown>) => {
        const toolResult = await t.execute(params);
        if (!toolResult.success) {
          throw new Error(toolResult.error || 'Tool execution failed');
        }
        return toolResult.data;
      },
    });
  }

  return result;
}

/**
 * Executes a skill with the given context
 */
export async function executeSkill(ctx: SkillExecutionContext): Promise<SkillResult> {
  const { skill, instructions, context, conversationHistory } = ctx;

  try {
    // Register custom tools if the skill has any
    if (skill.customTools) {
      registerTools(Object.values(skill.customTools));
    }

    // Get requested tools
    const requestedTools = getTools(skill.tools);

    // Add custom tools if available
    if (skill.customTools) {
      requestedTools.push(...Object.values(skill.customTools));
    }

    // Get the model
    const model = getModel(skill.model);

    // Build prompts
    const systemPrompt = buildSkillSystemPrompt(skill);
    const userPrompt = buildSkillUserPrompt(instructions, context);

    // Convert tools to AI SDK format
    const aiTools = convertToolsToAISDK(requestedTools);

    // Execute with the model
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      tools: aiTools as Parameters<typeof generateText>[0]['tools'],
      maxSteps: 10, // Allow up to 10 tool calls
    });

    // Collect tool calls for logging (simplified for type safety)
    const toolCalls = result.steps
      .flatMap((step: { toolCalls?: Array<{ toolName: string; args: unknown }> }) => step.toolCalls || [])
      .map((tc: { toolName: string; args: unknown }) => ({
        tool: tc.toolName,
        params: tc.args as Record<string, unknown>,
        result: {
          success: true,
          data: undefined, // Tool results are consumed by the model
        },
      }));

    return {
      success: true,
      response: result.text,
      toolCalls,
    };
  } catch (error) {
    return {
      success: false,
      response: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Formats conversation history for context
 */
export function formatConversationHistory(messages: Message[]): string {
  return messages
    .slice(-10) // Last 10 messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
}
