import { join } from 'path';
import { embed } from 'ai';
import { Schema, Field, Int32, Float32, Utf8, FixedSizeList } from 'apache-arrow';
import { loadConfig, resolveModelConfig } from '../config.js';
import { getEmbeddingModel } from '../providers/index.js';

const VECTORS_DIR = join(process.cwd(), 'memory', 'vectors');

let table: any = null;
let available = false;

export function isVectorMemoryAvailable(): boolean {
  return available;
}

export async function initVectorMemory(): Promise<void> {
  try {
    const lancedb = await import('@lancedb/lancedb');
    const db = await lancedb.connect(VECTORS_DIR);

    const tableNames = await db.tableNames();
    if (tableNames.includes('conversations')) {
      table = await db.openTable('conversations');
    } else {
      const schema = new Schema([
        new Field('text', new Utf8()),
        new Field('embedding', new FixedSizeList(768, new Field('item', new Float32()))),
        new Field('timestamp', new Utf8()),
        new Field('turnIndex', new Int32()),
      ]);
      table = await db.createEmptyTable('conversations', schema);
    }

    // Test that embedding model works
    const config = loadConfig();
    const embeddingModel = getEmbeddingModel(resolveModelConfig('embedding', config));
    await embed({ model: embeddingModel, value: 'test' });

    available = true;
  } catch {
    available = false;
  }
}

export async function storeConversationTurn(userMsg: string, assistantMsg: string): Promise<void> {
  if (!table) return;

  const text = `user: ${userMsg} | assistant: ${assistantMsg}`;
  const config = loadConfig();
  const embeddingModel = getEmbeddingModel(resolveModelConfig('embedding', config));

  const { embedding } = await embed({ model: embeddingModel, value: text });

  await table.add([{
    text,
    embedding,
    timestamp: new Date().toISOString(),
    turnIndex: Date.now(),
  }]);
}

export async function retrieveRelevantContext(query: string, limit = 3): Promise<string[]> {
  if (!table) return [];

  try {
    const config = loadConfig();
    const embeddingModel = getEmbeddingModel(resolveModelConfig('embedding', config));
    const { embedding } = await embed({ model: embeddingModel, value: query });

    const results = await table.vectorSearch(embedding).limit(limit).toArray();
    return results.map((r: any) => r.text);
  } catch {
    return [];
  }
}
