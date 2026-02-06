import { loadConfig } from './config.js';

interface UsageRecord {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: number;
}

interface Pricing {
  input: number;   // $ per million tokens
  output: number;  // $ per million tokens
}

const sessionUsage: UsageRecord[] = [];

function getPricing(modelKey: string): Pricing | null {
  const config = loadConfig();
  const pricing = (config as any).pricing?.[modelKey];
  if (!pricing) return null;
  return { input: pricing.input, output: pricing.output };
}

function calculateCost(promptTokens: number, completionTokens: number, pricing: Pricing): number {
  return (promptTokens * pricing.input / 1_000_000) + (completionTokens * pricing.output / 1_000_000);
}

export function recordUsage(
  modelKey: string,
  provider: string,
  usage: { promptTokens: number; completionTokens: number }
): void {
  const pricing = getPricing(modelKey);
  const cost = pricing ? calculateCost(usage.promptTokens, usage.completionTokens, pricing) : 0;

  sessionUsage.push({
    model: modelKey,
    provider,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cost,
    timestamp: Date.now(),
  });
}

export function getSessionCost(): number {
  return sessionUsage.reduce((sum, r) => sum + r.cost, 0);
}

export function getSessionTokens(): { prompt: number; completion: number } {
  return sessionUsage.reduce(
    (acc, r) => ({
      prompt: acc.prompt + r.promptTokens,
      completion: acc.completion + r.completionTokens,
    }),
    { prompt: 0, completion: 0 }
  );
}

export function getLastRequestCost(): number {
  if (sessionUsage.length === 0) return 0;
  return sessionUsage[sessionUsage.length - 1].cost;
}

export function formatCost(dollars: number): string {
  if (dollars === 0) return '$0.00';
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

export function getSessionSummary(): string {
  const tokens = getSessionTokens();
  const cost = getSessionCost();
  const paidCalls = sessionUsage.filter(r => r.cost > 0).length;
  const freeCalls = sessionUsage.filter(r => r.cost === 0).length;

  const lines = [
    `Tokens: ${(tokens.prompt + tokens.completion).toLocaleString()} (${tokens.prompt.toLocaleString()} in / ${tokens.completion.toLocaleString()} out)`,
    `API calls: ${sessionUsage.length} (${paidCalls} paid, ${freeCalls} free)`,
    `Session cost: ${formatCost(cost)}`,
  ];

  return lines.join('\n');
}
