import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generateText } from 'ai';
import { getModel } from '../providers/index.js';
import { loadConfig, resolveModelConfig } from '../config.js';
import type { Message } from './memory.js';

const MEMORY_DIR = join(process.cwd(), 'memory');
const SUMMARY_FILE = join(MEMORY_DIR, 'summary.json');
const TOKEN_BUDGET = 2000;
const SUMMARIZE_THRESHOLD = 4;

interface SummaryState {
  summary: string;
  summarizedUpToIndex: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function loadSummaryState(): SummaryState {
  if (!existsSync(SUMMARY_FILE)) {
    return { summary: '', summarizedUpToIndex: 0 };
  }
  try {
    return JSON.parse(readFileSync(SUMMARY_FILE, 'utf-8')) as SummaryState;
  } catch {
    return { summary: '', summarizedUpToIndex: 0 };
  }
}

function saveSummaryState(state: SummaryState): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
  writeFileSync(SUMMARY_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function summarizeMessages(existingSummary: string, messages: Message[]): Promise<string> {
  const formatted = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = existingSummary
    ? `Existing summary of earlier conversation:\n${existingSummary}\n\nNew messages to incorporate:\n${formatted}\n\nWrite a concise updated summary capturing all key information, decisions, and context. Be brief but complete.`
    : `Summarize this conversation so far, capturing key information, decisions, and context. Be brief but complete:\n\n${formatted}`;

  try {
    const config = loadConfig();
    const model = getModel(resolveModelConfig('local-fast', config));
    const result = await generateText({ model, prompt });
    return result.text || existingSummary;
  } catch {
    return existingSummary;
  }
}

export async function getSummaryContext(history: Message[]): Promise<{ summary: string; recentMessages: Message[] }> {
  if (history.length === 0) {
    return { summary: '', recentMessages: [] };
  }

  // Walk backwards to find how many recent messages fit in budget
  let tokenCount = 0;
  let recentStartIndex = history.length;
  for (let i = history.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(`${history[i].role}: ${history[i].content}`);
    if (tokenCount + msgTokens > TOKEN_BUDGET) break;
    tokenCount += msgTokens;
    recentStartIndex = i;
  }

  const state = loadSummaryState();

  // Check how many unsummarized messages exist before the recent window
  const unsummarizedStart = state.summarizedUpToIndex;
  const unsummarizedEnd = recentStartIndex;
  const unsummarizedCount = unsummarizedEnd - unsummarizedStart;

  if (unsummarizedCount >= SUMMARIZE_THRESHOLD) {
    const toSummarize = history.slice(unsummarizedStart, unsummarizedEnd);
    const newSummary = await summarizeMessages(state.summary, toSummarize);
    const newState: SummaryState = { summary: newSummary, summarizedUpToIndex: unsummarizedEnd };
    saveSummaryState(newState);
    return { summary: newSummary, recentMessages: history.slice(recentStartIndex) };
  }

  return { summary: state.summary, recentMessages: history.slice(recentStartIndex) };
}

export function clearSummary(): void {
  const emptyState: SummaryState = { summary: '', summarizedUpToIndex: 0 };
  saveSummaryState(emptyState);
}
