/**
 * Phase 7 — Context Intelligence
 *
 * Two-tier conversation memory:
 *   • Short-term  — last N turns (in-memory, fast lookup)
 *   • Long-term   — persisted topic frequency + entity recall
 *
 * Also tracks the current "conversation topic" so a follow-up like
 * "under 30000?" gets resolved to "phones under 30000?" automatically.
 */

const LT_KEY = 'sofia_longterm_v1';

export interface ConversationTurn {
  q: string;
  a: string;
  category: string;
  topicTokens: string[];
  ts: number;
}

interface LongTerm {
  topicCounts: Record<string, number>;
  entityCounts: Record<string, number>;
  lastTopic?: string;
}

function loadLT(): LongTerm {
  try {
    const raw = localStorage.getItem(LT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { topicCounts: {}, entityCounts: {} };
}

function saveLT(lt: LongTerm) {
  try { localStorage.setItem(LT_KEY, JSON.stringify(lt)); } catch { /* ignore */ }
}

export class ContextMemory {
  private short: ConversationTurn[] = [];
  private long: LongTerm = loadLT();
  private maxShort = 20;
  private currentTopic: string | null = null;
  private topicTokens: string[] = [];

  pushTurn(turn: ConversationTurn) {
    this.short.push(turn);
    if (this.short.length > this.maxShort) this.short.shift();

    if (turn.category) {
      this.long.topicCounts[turn.category] = (this.long.topicCounts[turn.category] || 0) + 1;
      this.long.lastTopic = turn.category;
      this.currentTopic = turn.category;
    }
    if (turn.topicTokens?.length) {
      this.topicTokens = turn.topicTokens.slice(0, 8);
    }
    saveLT(this.long);
  }

  getShort() { return this.short; }
  getCurrentTopic() { return this.currentTopic; }
  getTopicTokens() { return this.topicTokens; }
  getTopTopics(n = 5) {
    return Object.entries(this.long.topicCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * Resolve a short follow-up query by prepending current topic tokens
   * so the search engine receives full context.
   */
  resolveFollowUp(text: string, isFollowUp: boolean): string {
    if (!isFollowUp && text.trim().split(/\s+/).length > 3) return text;
    if (!this.topicTokens.length) return text;
    return `${this.topicTokens.join(' ')} ${text}`.trim();
  }

  clear() {
    this.short = [];
    this.currentTopic = null;
    this.topicTokens = [];
    this.long = { topicCounts: {}, entityCounts: {} };
    try { localStorage.removeItem(LT_KEY); } catch { /* ignore */ }
  }

  snapshot() {
    return {
      shortLen: this.short.length,
      currentTopic: this.currentTopic,
      topTopics: this.getTopTopics(),
    };
  }
}
