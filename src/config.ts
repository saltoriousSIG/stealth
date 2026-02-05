import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';
import type { Config, ModelConfig } from './types.js';

const DEFAULT_CONFIG: Config = {
  models: {
    orchestrator: {
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
    },
    'local-fast': {
      provider: 'ollama',
      model: 'llama3.1:8b',
    },
    'local-code': {
      provider: 'ollama',
      model: 'deepseek-coder:7b',
    },
  },
  skills: {
    code: { model: 'local-code' },
    research: { model: 'local-fast' },
    shell: { model: 'local-fast' },
    files: { model: 'local-fast' },
  },
  keys: {},
  ollama: {
    host: 'http://localhost:11434',
  },
};

let cachedConfig: Config | null = null;

/**
 * Interpolates environment variables in a string
 * Supports ${VAR_NAME} syntax
 */
function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}

/**
 * Recursively interpolates environment variables in an object
 */
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

/**
 * Loads configuration from config.yaml
 * Falls back to defaults if file doesn't exist
 */
export function loadConfig(configPath?: string): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const path = configPath || join(process.cwd(), 'config.yaml');

  if (!existsSync(path)) {
    console.warn('No config.yaml found, using defaults');
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = parse(content) as Partial<Config>;

    // Merge with defaults
    cachedConfig = {
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      skills: { ...DEFAULT_CONFIG.skills, ...parsed.skills },
      keys: { ...DEFAULT_CONFIG.keys, ...parsed.keys },
      ollama: { ...DEFAULT_CONFIG.ollama, ...parsed.ollama },
    };

    // Interpolate environment variables
    cachedConfig = interpolateConfig(cachedConfig);

    return cachedConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }
}

/**
 * Resolves a model configuration by name or inline config
 */
export function resolveModelConfig(
  modelRef: string | ModelConfig,
  config: Config
): ModelConfig {
  // If it's already a full config, return it
  if (typeof modelRef === 'object' && modelRef.provider && modelRef.model) {
    return modelRef;
  }

  // Look up by name
  const modelName = typeof modelRef === 'string' ? modelRef : 'local-fast';
  const resolved = config.models[modelName];

  if (!resolved) {
    console.warn(`Model "${modelName}" not found, falling back to local-fast`);
    return config.models['local-fast'] || DEFAULT_CONFIG.models['local-fast'];
  }

  return resolved;
}

/**
 * Gets the model config for a specific skill
 * Priority: SKILL.md override > config.yaml skill setting > default
 */
export function getSkillModelConfig(
  skillName: string,
  skillOverride?: string | ModelConfig,
  config?: Config
): ModelConfig {
  const cfg = config || loadConfig();

  // 1. Check skill override from SKILL.md
  if (skillOverride) {
    return resolveModelConfig(skillOverride, cfg);
  }

  // 2. Check config.yaml skill-specific setting
  const skillConfig = cfg.skills[skillName];
  if (skillConfig?.model) {
    return resolveModelConfig(skillConfig.model, cfg);
  }

  // 3. Fall back to local-fast
  return resolveModelConfig('local-fast', cfg);
}

/**
 * Gets the orchestrator model config
 */
export function getOrchestratorModelConfig(config?: Config): ModelConfig {
  const cfg = config || loadConfig();
  return cfg.models.orchestrator || DEFAULT_CONFIG.models.orchestrator;
}

/**
 * Gets an API key by name
 */
export function getApiKey(keyName: 'openrouter' | 'tavily', config?: Config): string | undefined {
  const cfg = config || loadConfig();
  return cfg.keys[keyName];
}

/**
 * Gets the Ollama host
 */
export function getOllamaHost(config?: Config): string {
  const cfg = config || loadConfig();
  return cfg.ollama.host;
}

/**
 * Clears the cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
