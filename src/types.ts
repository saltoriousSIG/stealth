// Core identity types
export interface Identity {
  soul: string;
  brain: string;
  imperative: string;
}

// Model configuration
export interface ModelConfig {
  provider: 'openrouter' | 'ollama';
  model: string;
}

// Named model configurations from config.yaml
export interface ModelsConfig {
  [name: string]: ModelConfig;
}

// Skill configuration from config.yaml
export interface SkillConfig {
  model: string; // Reference to a named model config
}

// Full configuration structure
export interface Config {
  models: ModelsConfig;
  skills: Record<string, SkillConfig>;
  keys: {
    openrouter?: string;
    tavily?: string;
  };
  ollama: {
    host: string;
  };
}

// Skill definition parsed from SKILL.md
export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  model: ModelConfig;
  tools: string[];
  executionPattern: string[];
  rawContent: string;
  customTools?: Record<string, Tool>;
}

// Tool interface
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Orchestrator action types
export type ActionType = 'delegateToSkill' | 'respondDirectly' | 'clarify' | 'updateBrain';

export interface Action {
  type: ActionType;
  skill?: string;
  instructions?: string;
  context?: Record<string, unknown>;
  message?: string;
}

export interface OrchestratorPlan {
  actions: Action[];
  response?: string;
}

// Conversation types
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ConversationContext {
  messages: Message[];
  identity: Identity;
  skills: Map<string, Skill>;
}

// Skill execution context
export interface SkillExecutionContext {
  skill: Skill;
  instructions: string;
  context: Record<string, unknown>;
  conversationHistory: Message[];
}

// Skill execution result
export interface SkillResult {
  success: boolean;
  response: string;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  result: ToolResult;
}
