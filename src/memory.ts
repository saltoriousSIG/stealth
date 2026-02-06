import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

const MEMORY_DIR = join(process.cwd(), 'memory');
const CONVERSATION_FILE = join(MEMORY_DIR, 'conversation.json');

let conversationHistory: Message[] = [];

function ensureMemoryDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

export function addMessage(message: Message): void {
  conversationHistory.push({
    ...message,
    timestamp: message.timestamp || new Date(),
  });
}

export function getConversationHistory(): Message[] {
  return [...conversationHistory];
}

export function getRecentMessages(count: number): Message[] {
  return conversationHistory.slice(-count);
}

export function clearConversation(): void {
  conversationHistory = [];
}

export function saveConversation(): void {
  ensureMemoryDir();
  try {
    writeFileSync(CONVERSATION_FILE, JSON.stringify(conversationHistory, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}

export function loadConversation(): void {
  if (!existsSync(CONVERSATION_FILE)) return;

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
