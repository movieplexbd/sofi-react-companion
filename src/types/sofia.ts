import type { SentimentType } from '../engine/sentiment';

export interface QAItem {
  firebaseKey: string;
  originalQuestions: string[];
  processedQuestions: string[];
  answer: string;
  category: string;
  tags: string[];
  feedback: { positive: number; negative: number };
}

export interface BotConfig {
  botName: string;
  version: string;
  language: string;
  searchWeights: Record<string, number>;
  thresholds: Record<string, number>;
  features: Record<string, boolean>;
}

export interface DataStore {
  qa: QAItem[];
  syn: Record<string, string[]>;
  int: Record<string, { patterns?: string[]; keywords?: string[]; responses?: string[]; action?: string; priority?: number }>;
  ctx: Record<string, { trigger_context: string; boost_category: string }>;
  ent: Record<string, string[]>;
  tpl: Record<string, string[]>;
  spell: Record<string, string>;
  sent: { positive: string[]; negative: string[]; urgent: string[]; confused: string[] };
  cfg: BotConfig;
}

export interface RuntimeState {
  state: 'normal' | 'asking_teach' | 'awaiting_answer';
  learningQ: string | null;
  userName: string | null;
  history: Array<{ q: string; a: string; category: string; time: number }>;
  activeCtx: { name: string | null; lifespan: number };
  memory: { topics: string[]; entities: Record<string, string[]>; preferences: Record<string, unknown> };
  personality: string;
  initialized: boolean;
  lastAnswer: string | null;
  lastUserQ: string | null;
  sessionId: string;
  stats: { totalMessages: number; matchedCount: number; noMatchCount: number; avgScore: number };
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  firebaseKey?: string | null;
  method?: string | null;
  score?: number | null;
  sentiment?: SentimentType;
  related?: string[] | null;
  quickReplies?: string[] | null;
  spellCorrected?: boolean;
  originalText?: string | null;
  isMath?: boolean;
  reactions?: string[];
  threadId?: string;
}

export interface AnalyticsEntry {
  method: string;
  score: number;
  timestamp: number;
  category?: string;
}
