import type { ModelConfig } from '../types.js';
import { getOpenRouterModel } from './openrouter.js';
import { getOllamaModel } from './ollama.js';

export { getOpenRouterProvider, getOpenRouterModel } from './openrouter.js';
export { getOllamaProvider, getOllamaModel, checkOllamaConnection, listOllamaModels } from './ollama.js';

// Use a more permissive type to handle different provider SDK versions
type LanguageModel = ReturnType<typeof getOpenRouterModel> | ReturnType<typeof getOllamaModel>;

/**
 * Gets a language model based on the model configuration
 */
export function getModel(config: ModelConfig): LanguageModel {
  switch (config.provider) {
    case 'openrouter':
      return getOpenRouterModel(config.model);

    case 'ollama':
      return getOllamaModel(config.model);

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Checks if a model configuration is for a local model
 */
export function isLocalModel(config: ModelConfig): boolean {
  return config.provider === 'ollama';
}

/**
 * Checks if a model configuration is for a cloud model
 */
export function isCloudModel(config: ModelConfig): boolean {
  return config.provider === 'openrouter';
}
