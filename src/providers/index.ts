import type { ModelConfig } from '../config.js';
import { getOpenRouterModel } from './openrouter.js';
import { getOllamaModel, getOllamaEmbeddingModel } from './ollama.js';

export { getOpenRouterProvider, getOpenRouterModel } from './openrouter.js';
export { getOllamaProvider, getOllamaModel, getOllamaEmbeddingModel, checkOllamaConnection, listOllamaModels } from './ollama.js';

type LanguageModel = ReturnType<typeof getOpenRouterModel> | ReturnType<typeof getOllamaModel>;

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

export function getEmbeddingModel(config: ModelConfig) {
  switch (config.provider) {
    case 'ollama':
      return getOllamaEmbeddingModel(config.model);
    default:
      throw new Error(`Embedding not supported for provider: ${config.provider}`);
  }
}
