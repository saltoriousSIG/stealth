import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Tool, ToolResult } from '../types.js';

/**
 * Read file tool
 */
export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Reads the contents of a file at the specified path',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to read',
      },
    },
    required: ['path'],
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const { path } = params as { path: string };
      const absolutePath = join(process.cwd(), path);

      if (!existsSync(absolutePath)) {
        return {
          success: false,
          error: `File not found: ${path}`,
        };
      }

      const content = readFileSync(absolutePath, 'utf-8');
      return {
        success: true,
        data: content,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Write file tool
 */
export const writeFileTool: Tool = {
  name: 'writeFile',
  description: 'Writes content to a file at the specified path, creating directories if needed',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const { path, content } = params as { path: string; content: string };
      const absolutePath = join(process.cwd(), path);

      // Ensure directory exists
      const dir = dirname(absolutePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(absolutePath, content, 'utf-8');
      return {
        success: true,
        data: { path, bytesWritten: content.length },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * List directory tool
 */
export const listDirectoryTool: Tool = {
  name: 'listDirectory',
  description: 'Lists the contents of a directory with file metadata',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the directory to list (defaults to current directory)',
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list subdirectories recursively',
      },
    },
    required: [],
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const { path = '.', recursive = false } = params as { path?: string; recursive?: boolean };
      const absolutePath = join(process.cwd(), path);

      if (!existsSync(absolutePath)) {
        return {
          success: false,
          error: `Directory not found: ${path}`,
        };
      }

      const entries = listDir(absolutePath, recursive);
      return {
        success: true,
        data: entries,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

function listDir(dirPath: string, recursive: boolean, basePath = ''): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];

  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = join(dirPath, item);
    const relativePath = basePath ? join(basePath, item) : item;

    try {
      const stat = statSync(fullPath);
      const isDirectory = stat.isDirectory();

      entries.push({
        name: item,
        path: relativePath,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : stat.size,
      });

      if (recursive && isDirectory && !item.startsWith('.') && item !== 'node_modules') {
        entries.push(...listDir(fullPath, true, relativePath));
      }
    } catch {
      // Skip entries we can't stat
    }
  }

  return entries;
}

/**
 * All file tools
 */
export const fileTools: Tool[] = [readFileTool, writeFileTool, listDirectoryTool];
