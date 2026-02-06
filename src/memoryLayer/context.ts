import { getConversationHistory, getTurnCount, getLastMessageTime } from './memory.js';
import { getSummaryContext } from './summary.js';
import { retrieveRelevantContext, isVectorMemoryAvailable } from './vectorMemory.js';

function getConversationPhaseHint(): string {
  const turns = getTurnCount();
  const lastTime = getLastMessageTime();

  if (turns === 0) {
    return '[Conversation Phase: Opening — first message of the session.]';
  }

  // Check for long gap between messages
  if (lastTime) {
    const minutesSinceLast = (Date.now() - lastTime.getTime()) / 1000 / 60;
    if (minutesSinceLast > 30) {
      return `[Conversation Phase: Returning after ${Math.round(minutesSinceLast)} minutes. Brief acknowledgment is fine, no re-introductions.]`;
    }
  }

  if (turns <= 2) {
    return `[Conversation Phase: Early, turn ${turns + 1}. No need to re-greet.]`;
  }

  return `[Conversation Phase: Mid-conversation, turn ${turns + 1}. Continue naturally — no greetings, jump straight in.]`;
}

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

  sections.push(getConversationPhaseHint());

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
