import { createOllama } from 'ollama-ai-provider';
import { getOllamaHost } from '../config.js';

let ollamaProvider: ReturnType<typeof createOllama> | null = null;

/**
 * Gets or creates the Ollama provider instance
 */
export function getOllamaProvider(): ReturnType<typeof createOllama> {
  if (ollamaProvider) {
    return ollamaProvider;
  }

  const host = getOllamaHost();

  ollamaProvider = createOllama({
    baseURL: `${host}/api`,
  });

  return ollamaProvider;
}

/**
 * Gets an Ollama model by name
 */
export function getOllamaModel(modelName: string): ReturnType<ReturnType<typeof createOllama>> {
  const provider = getOllamaProvider();
  return provider(modelName);
}

/**
 * Checks if Ollama is available
 */
export async function checkOllamaConnection(): Promise<boolean> {
  const host = getOllamaHost();

  try {
    const response = await fetch(`${host}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Lists available Ollama models
 */
export async function listOllamaModels(): Promise<string[]> {
  const host = getOllamaHost();

  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as { models: Array<{ name: string }> };
    return data.models.map(m => m.name);
  } catch {
    return [];
  }
}

/**
 * Gets an Ollama text embedding model by name
 */
export function getOllamaEmbeddingModel(modelName: string) {
  const provider = getOllamaProvider();
  return provider.textEmbeddingModel(modelName);
}
