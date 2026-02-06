// TODO: Tool usage telemetry
// TODO: Tool validation on load

import type { Tool } from 'ai';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as primitives from './primitives.js';

const TOOLS_DIR = fileURLToPath(new URL('.', import.meta.url));
const MANIFEST_PATH = join(TOOLS_DIR, 'manifest.json');

interface Manifest {
  toolFiles: string[];
  skillToolMap: Record<string, string[]>;
}

const registry: Record<string, Tool> = {};

// Always load primitives directly
for (const [name, val] of Object.entries(primitives)) {
  registry[name] = val;
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return { toolFiles: ['primitives'], skillToolMap: {} };
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function writeManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

/** Load generated tool files listed in manifest */
export async function loadGeneratedTools(): Promise<void> {
  const manifest = readManifest();
  for (const name of manifest.toolFiles) {
    if (name === 'primitives') continue;
    try {
      const mod = await import(`./${name}.js`);
      for (const [key, value] of Object.entries(mod)) {
        if (key !== 'default') registry[key] = value as Tool;
      }
    } catch (err) {
      console.warn(`Failed to load tool module "${name}":`, err);
    }
  }
}

/** Add a generated tool file to the manifest */
export function addToolFile(name: string): void {
  const manifest = readManifest();
  if (!manifest.toolFiles.includes(name)) {
    manifest.toolFiles.push(name);
    writeManifest(manifest);
  }
}

/** Get the cached skill→tool mapping */
export function getSkillToolMap(): Record<string, string[]> {
  return readManifest().skillToolMap;
}

/** Save the skill→tool mapping to manifest */
export function saveSkillToolMap(map: Record<string, string[]>): void {
  const manifest = readManifest();
  manifest.skillToolMap = map;
  writeManifest(manifest);
}

export function getTools(names?: string[]): Record<string, Tool> {
  if (!names || names.length === 0) return { ...registry };
  const result: Record<string, Tool> = {};
  for (const name of names) {
    if (registry[name]) result[name] = registry[name];
  }
  return result;
}

export function registerTool(name: string, tool: Tool): void {
  registry[name] = tool;
}

export function listToolNames(): string[] {
  return Object.keys(registry);
}
