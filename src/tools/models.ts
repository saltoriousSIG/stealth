import { generateText } from 'ai';
import type { Tool, ToolResult, ModelConfig } from '../types.js';
import { getModel } from '../providers/index.js';
import { resolveModelConfig, loadConfig } from '../config.js';

/**
 * Call model tool - allows skills to invoke other models
 */
export const callModelTool: Tool = {
  name: 'callModel',
  description: 'Calls an AI model with a prompt and returns the response',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'The model name from config (e.g., "local-fast", "local-code") or leave empty for default',
      },
      prompt: {
        type: 'string',
        description: 'The prompt to send to the model',
      },
      system: {
        type: 'string',
        description: 'Optional system prompt',
      },
    },
    required: ['prompt'],
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const {
        model = 'local-fast',
        prompt,
        system,
      } = params as { model?: string; prompt: string; system?: string };

      const config = loadConfig();
      const modelConfig = resolveModelConfig(model, config);

      const response = await callModel({
        modelConfig,
        prompt,
        system,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to call model: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

interface CallModelParams {
  modelConfig: ModelConfig;
  prompt: string;
  system?: string;
  maxTokens?: number;
}

/**
 * Calls a model with the given parameters
 */
export async function callModel({
  modelConfig,
  prompt,
  system,
  maxTokens = 4096,
}: CallModelParams): Promise<string> {
  const model = getModel(modelConfig);

  const result = await generateText({
    model,
    prompt,
    system,
    maxTokens,
  });

  return result.text;
}

/**
 * All model tools
 */
export const modelTools: Tool[] = [callModelTool];
