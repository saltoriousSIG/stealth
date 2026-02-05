import { createOpenAI } from '@ai-sdk/openai';
import { getApiKey } from '../config.js';

let openRouterProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Gets or creates the OpenRouter provider instance
 * OpenRouter uses an OpenAI-compatible API
 */
export function getOpenRouterProvider(): ReturnType<typeof createOpenAI> {
  if (openRouterProvider) {
    return openRouterProvider;
  }

  const apiKey = getApiKey('openrouter');

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY not found. Set it in config.yaml or as an environment variable.'
    );
  }

  openRouterProvider = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://github.com/jarvis-agent', // Optional: for OpenRouter rankings
      'X-Title': 'Jarvis Agent', // Optional: for OpenRouter dashboard
    },
  });

  return openRouterProvider;
}

/**
 * Gets an OpenRouter model by name
 * Model names follow format: provider/model-name (e.g., anthropic/claude-3-opus)
 */
export function getOpenRouterModel(modelName: string) {
  const provider = getOpenRouterProvider();
  return provider(modelName);
}
