// TODO: Command allowlist/blocklist for safety
// TODO: Glob/search tool
// TODO: Better HTML-to-text (use a library)
// TODO: Rate limiting for web tools
// TODO: Binary file detection

import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export const executeCommand = tool({
  description: 'Execute a shell command. Returns stdout directly, with stderr and exit code appended only when non-empty/non-zero.',
  parameters: z.object({
    command: z.string().describe('Shell command to execute'),
    cwd: z.string().optional().describe('Working directory'),
    timeout: z.number().optional().describe('Timeout in ms (default 30000)'),
  }),
  execute: async ({ command, cwd, timeout = 30000 }) => {
    return new Promise<string>((resolve) => {
      exec(command, { cwd: cwd || process.cwd(), timeout }, (error, stdout, stderr) => {
        const out = stdout.trim();
        const err = stderr.trim();
        const exitCode = error?.code ?? (error ? 1 : 0);
        const parts: string[] = [];
        if (out) parts.push(out);
        if (err) parts.push(`[stderr] ${err}`);
        if (exitCode !== 0) parts.push(`[exit code: ${exitCode}]`);
        resolve(parts.join('\n') || '(no output)');
      });
    });
  },
});

export const readFile = tool({
  description: 'Read file contents',
  parameters: z.object({ path: z.string().describe('File path') }),
  execute: async ({ path }) => {
    const abs = join(process.cwd(), path);
    if (!existsSync(abs)) throw new Error(`Not found: ${path}`);
    return readFileSync(abs, 'utf-8');
  },
});

export const writeFile = tool({
  description: 'Write content to a file. Returns confirmation with path and bytes written.',
  parameters: z.object({
    path: z.string().describe('File path'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    const abs = join(process.cwd(), path);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(abs, content, 'utf-8');
    return `Wrote ${content.length} bytes to ${path}`;
  },
});

export const listDirectory = tool({
  description: 'List directory contents. Returns a formatted listing with type indicators.',
  parameters: z.object({ path: z.string().optional().describe('Directory (default: cwd)') }),
  execute: async ({ path = '.' }) => {
    const abs = join(process.cwd(), path);
    if (!existsSync(abs)) throw new Error(`Not found: ${path}`);
    const entries = readdirSync(abs)
      .filter(f => !f.startsWith('.') && f !== 'node_modules')
      .map(name => {
        const type = statSync(join(abs, name)).isDirectory() ? 'dir' : 'file';
        return `[${type}] ${name}`;
      });
    return entries.join('\n') || '(empty directory)';
  },
});

export const webSearch = tool({
  description: 'Search the web using Tavily',
  parameters: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().optional().describe('Max results (default 5)'),
  }),
  execute: async ({ query, maxResults = 5 }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('TAVILY_API_KEY not set');
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
    });
    if (!res.ok) throw new Error(`Tavily error: ${res.status}`);
    const data = await res.json() as { results: Array<{ title: string; url: string; content: string }> };
    return data.results.map(r => ({ title: r.title, url: r.url, snippet: r.content }));
  },
});

export const fetchPage = tool({
  description: 'Fetch readable content from a URL',
  parameters: z.object({ url: z.string().describe('URL to fetch') }),
  execute: async ({ url }) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Jarvis-Agent/1.0' } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const html = await res.text();
    return {
      url,
      content: html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000),
    };
  },
});
