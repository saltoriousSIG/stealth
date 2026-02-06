import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

export interface ModelConfig {
  provider: 'openrouter' | 'ollama';
  model: string;
}

export interface SkillConfig {
  model: string;
}

export interface Config {
  models: Record<string, ModelConfig>;
  skills: Record<string, SkillConfig>;
  keys: Record<string, string>;
  ollama: { host: string };
}

const DEFAULT_CONFIG: Config = {
  models: {
    default: {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
    },
    'local-fast': {
      provider: 'ollama',
      model: 'llama3.1:8b',
    },
  },
  skills: {},
  keys: {},
  ollama: {
    host: 'http://localhost:11434',
  },
};

let cachedConfig: Config | null = null;

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}

function interpolateConfig<T>(obj: T): T {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateConfig) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateConfig(value);
    }
    return result as T;
  }
  return obj;
}

export function loadConfig(configPath?: string): Config {
  if (cachedConfig) return cachedConfig;

  const path = configPath || join(process.cwd(), 'config.yaml');

  if (!existsSync(path)) {
    console.warn('No config.yaml found, using defaults');
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = parse(content) as Partial<Config>;

    cachedConfig = {
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      skills: { ...DEFAULT_CONFIG.skills, ...parsed.skills },
      keys: { ...DEFAULT_CONFIG.keys, ...parsed.keys },
      ollama: { ...DEFAULT_CONFIG.ollama, ...parsed.ollama },
    };

    cachedConfig = interpolateConfig(cachedConfig);
    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }
}

export function getApiKey(keyName: string, config?: Config): string | undefined {
  const cfg = config || loadConfig();
  return cfg.keys[keyName];
}

export function getOllamaHost(config?: Config): string {
  const cfg = config || loadConfig();
  return cfg.ollama.host;
}

export function resolveModelConfig(modelName: string, config?: Config): ModelConfig {
  const cfg = config || loadConfig();
  const mc = cfg.models[modelName];
  if (!mc) throw new Error(`Unknown model: ${modelName}`);
  return mc;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
