import { spawn } from 'child_process';
import type { Tool, ToolResult } from '../types.js';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_OUTPUT_LENGTH = 50000; // 50KB

/**
 * Execute shell command tool
 */
export const executeCommandTool: Tool = {
  name: 'executeCommand',
  description: 'Executes a shell command and returns the output',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      cwd: {
        type: 'string',
        description: 'The working directory for the command (defaults to current directory)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (defaults to 30000)',
      },
    },
    required: ['command'],
  },
  execute: async (params): Promise<ToolResult> => {
    const {
      command,
      cwd = process.cwd(),
      timeout = DEFAULT_TIMEOUT,
    } = params as { command: string; cwd?: string; timeout?: number };

    return executeCommand(command, cwd, timeout);
  },
};

/**
 * Executes a shell command and returns the result
 */
export function executeCommand(
  command: string,
  cwd: string = process.cwd(),
  timeout: number = DEFAULT_TIMEOUT
): Promise<ToolResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn('sh', ['-c', command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 1000);
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT_LENGTH) {
        stdout = stdout.slice(0, MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
        child.kill('SIGTERM');
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT_LENGTH) {
        stderr = stderr.slice(0, MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        error: `Failed to execute command: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (killed) {
        resolve({
          success: false,
          error: `Command timed out after ${timeout}ms`,
          data: { stdout, stderr },
        });
        return;
      }

      if (code === 0) {
        resolve({
          success: true,
          data: {
            exitCode: code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          },
        });
      } else {
        resolve({
          success: false,
          error: `Command exited with code ${code}`,
          data: {
            exitCode: code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          },
        });
      }
    });
  });
}

/**
 * All shell tools
 */
export const shellTools: Tool[] = [executeCommandTool];
