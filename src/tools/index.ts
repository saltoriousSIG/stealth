import type { Tool } from '../types.js';
import { fileTools, readFileTool, writeFileTool, listDirectoryTool } from './files.js';
import { shellTools, executeCommandTool, executeCommand } from './shell.js';
import { modelTools, callModelTool, callModel } from './models.js';

// Re-export individual tools
export {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  executeCommandTool,
  executeCommand,
  callModelTool,
  callModel,
};

// All core tools combined
export const coreTools: Tool[] = [...fileTools, ...shellTools, ...modelTools];

// Tool registry for easy lookup
const toolRegistry = new Map<string, Tool>();

// Register all core tools
for (const tool of coreTools) {
  toolRegistry.set(tool.name, tool);
}

/**
 * Gets a tool by name
 */
export function getTool(name: string): Tool | undefined {
  return toolRegistry.get(name);
}

/**
 * Gets multiple tools by name
 */
export function getTools(names: string[]): Tool[] {
  const tools: Tool[] = [];
  for (const name of names) {
    const tool = toolRegistry.get(name);
    if (tool) {
      tools.push(tool);
    }
  }
  return tools;
}

/**
 * Registers a custom tool
 */
export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.name, tool);
}

/**
 * Registers multiple custom tools
 */
export function registerTools(tools: Tool[]): void {
  for (const tool of tools) {
    registerTool(tool);
  }
}

/**
 * Gets all registered tool names
 */
export function getToolNames(): string[] {
  return Array.from(toolRegistry.keys());
}

/**
 * Gets all registered tools
 */
export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

/**
 * Converts tools to the Vercel AI SDK tool format
 */
export function toAISDKTools(tools: Tool[]): Record<string, {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}> {
  const result: Record<string, {
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
    execute: (params: Record<string, unknown>) => Promise<unknown>;
  }> = {};

  for (const tool of tools) {
    result[tool.name] = {
      description: tool.description,
      parameters: tool.parameters,
      execute: async (params) => {
        const toolResult = await tool.execute(params);
        if (!toolResult.success) {
          throw new Error(toolResult.error || 'Tool execution failed');
        }
        return toolResult.data;
      },
    };
  }

  return result;
}
