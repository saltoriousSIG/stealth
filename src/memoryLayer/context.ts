import { getConversationHistory } from './memory.js';
import { getSummaryContext } from './summary.js';
import { retrieveRelevantContext, isVectorMemoryAvailable } from './vectorMemory.js';

export async function getConversationContext(currentMessage: string): Promise<string> {
  const history = getConversationHistory();
  const { summary, recentMessages } = await getSummaryContext(history);

  // Vector retrieval for cross-session context
  let pastContext: string[] = [];
  if (isVectorMemoryAvailable()) {
    pastContext = await retrieveRelevantContext(currentMessage);

    // Filter out turns that overlap with recent messages to avoid duplication
    const recentText = new Set(
      recentMessages.map(m => m.content.toLowerCase().trim())
    );
    pastContext = pastContext.filter(
      turn => !recentText.has(turn.split(' | ')[0]?.replace('user: ', '').toLowerCase().trim())
    );
  }

  const sections: string[] = [];

  if (pastContext.length > 0) {
    sections.push(`[Relevant Past Context]\n${pastContext.join('\n')}`);
  }

  if (summary) {
    sections.push(`[Conversation Summary]\n${summary}`);
  }

  if (recentMessages.length > 0) {
    const formatted = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    sections.push(`[Recent Messages]\n${formatted}`);
  }

  return sections.join('\n\n');
}
