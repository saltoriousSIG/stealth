// TODO: Validate generated code compiles before saving
// TODO: Flag complex stubs for code skill to expand later (task manager)

import { generateText } from 'ai';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { Skill } from './types.js';
import { loadConfig, resolveModelConfig } from '../config.js';
import { getModel } from '../providers/index.js';
import { addToolFile } from '../tools/index.js';

const TOOLS_DIR = fileURLToPath(new URL('../tools', import.meta.url));

function getTemplateCode(): string {
  const primitivesPath = join(TOOLS_DIR, 'primitives.ts');
  if (existsSync(primitivesPath)) return readFileSync(primitivesPath, 'utf-8');
  return '';
}

/** Generate missing tools for a skill and save to src/tools/ */
export async function generateMissingTools(skills: Map<string, Skill>): Promise<string[]> {
  const generated: string[] = [];
  const config = loadConfig();
  const model = getModel(resolveModelConfig('local-code', config));
  const template = getTemplateCode();

  for (const [name, skill] of skills) {
    const missing: string[] = (skill as any)._missingTools || [];
    if (missing.length === 0) continue;

    const fileName = `${name}_generated`;
    const filePath = join(TOOLS_DIR, `${fileName}.ts`);
    if (existsSync(filePath)) continue;

    try {
      const result = await generateText({
        model,
        prompt: `Generate a minimal TypeScript tool file. Use \`import { tool } from 'ai'\` and \`import { z } from 'zod'\`.

Export each tool as a named export. Keep implementations as simple stubs.
Add a // GENERATED STUB comment at the top.

Tools needed: ${missing.join(', ')}
Skill context: ${skill.systemPrompt}

Example pattern:
\`\`\`typescript
${template.slice(0, 1000)}
\`\`\`

Output ONLY TypeScript code. No markdown fences.`,
        maxTokens: 2048,
      });

      let code = result.text.trim();
      code = code.replace(/^```typescript?\n?/m, '').replace(/\n?```$/m, '');

      writeFileSync(filePath, code, 'utf-8');
      addToolFile(fileName);
      generated.push(fileName);
      console.log(`Generated tool stub: ${fileName}.ts`);
    } catch (err) {
      console.warn(`Failed to generate tools for "${name}":`, err);
    }
  }

  return generated;
}
