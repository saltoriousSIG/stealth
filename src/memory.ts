import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Message } from './types.js';

const MEMORY_DIR = join(process.cwd(), 'memory');
const CONVERSATION_FILE = join(MEMORY_DIR, 'conversation.json');

/**
 * In-memory conversation history
 */
let conversationHistory: Message[] = [];

/**
 * Ensures the memory directory exists
 */
function ensureMemoryDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

/**
 * Adds a message to the conversation history
 */
export function addMessage(message: Message): void {
  conversationHistory.push({
    ...message,
    timestamp: message.timestamp || new Date(),
  });
}

/**
 * Gets the full conversation history
 */
export function getConversationHistory(): Message[] {
  return [...conversationHistory];
}

/**
 * Gets the last N messages
 */
export function getRecentMessages(count: number): Message[] {
  return conversationHistory.slice(-count);
}

/**
 * Clears the conversation history
 */
export function clearConversation(): void {
  conversationHistory = [];
}

/**
 * Saves the conversation history to disk
 */
export function saveConversation(): void {
  ensureMemoryDir();

  try {
    writeFileSync(
      CONVERSATION_FILE,
      JSON.stringify(conversationHistory, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}

/**
 * Loads the conversation history from disk
 */
export function loadConversation(): void {
  if (!existsSync(CONVERSATION_FILE)) {
    return;
  }

  try {
    const content = readFileSync(CONVERSATION_FILE, 'utf-8');
    const loaded = JSON.parse(content) as Message[];
    conversationHistory = loaded.map(m => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
    }));
  } catch (error) {
    console.error('Failed to load conversation:', error);
    conversationHistory = [];
  }
}

/**
 * Formats conversation history for model context
 */
export function formatHistoryForContext(maxMessages = 10): string {
  const recent = getRecentMessages(maxMessages);

  if (recent.length === 0) {
    return '';
  }

  return recent
    .map(m => {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      return `${role}: ${m.content}`;
    })
    .join('\n\n');
}

/**
 * Gets a summary of the conversation (for Phase 2: long-term memory)
 */
export function getConversationSummary(): string {
  const messageCount = conversationHistory.length;

  if (messageCount === 0) {
    return 'No conversation history.';
  }

  const userMessages = conversationHistory.filter(m => m.role === 'user').length;
  const assistantMessages = conversationHistory.filter(m => m.role === 'assistant').length;

  return `Conversation has ${messageCount} messages (${userMessages} user, ${assistantMessages} assistant).`;
}
