/**
 * Phase 1 — Query Understanding Layer
 * Detects intent type (definition, comparison, recommendation, tutorial,
 * greeting, follow-up, question) from raw user text without any ML model.
 *
 * Pure pattern matching with Bangla + English + Banglish coverage.
 */

export type QueryIntent =
  | 'definition'
  | 'comparison'
  | 'recommendation'
  | 'tutorial'
  | 'greeting'
  | 'followup'
  | 'question'
  | 'statement';

export interface QueryMeta {
  intent: QueryIntent;
  confidence: number;
  signals: string[];        // which patterns fired (debug)
  isQuestion: boolean;
  hasNumber: boolean;
  hasPriceRange: boolean;
  language: 'bn' | 'en' | 'mixed';
}

/** Pattern groups — order matters: most specific first */
const PATTERNS: Array<{ intent: QueryIntent; re: RegExp; signal: string; weight: number }> = [
  // Tutorial / How-to
  { intent: 'tutorial',      re: /\b(how to|how do (i|you)|tutorial|guide|steps?)\b/i, signal: 'en-howto', weight: 0.9 },
  { intent: 'tutorial',      re: /(কিভাবে|কীভাবে|কি ভাবে|কীভাবে|ki vabe|kivabe|kibhabe|উপায়|পদ্ধতি|নিয়ম|বানাবো|বানানো|করবো|করব)/i, signal: 'bn-howto', weight: 0.9 },

  // Definition
  { intent: 'definition',    re: /\bwhat (is|are|does)\b|\bdefine\b|\bmeaning of\b/i, signal: 'en-def', weight: 0.85 },
  { intent: 'definition',    re: /(কাকে বলে|কি বোঝায়|মানে কি|অর্থ কি|কি জিনিস|কী জিনিস|কি এটা|কী এটা|definition)/i, signal: 'bn-def', weight: 0.85 },

  // Comparison
  { intent: 'comparison',    re: /\b(vs|versus|compare|difference between|better than|or)\b/i, signal: 'en-cmp', weight: 0.8 },
  { intent: 'comparison',    re: /(পার্থক্য|তুলনা|না কি|নাকি|কোনটা ভাল|কোনটা ভালো|কোনটি ভালো|বনাম)/i, signal: 'bn-cmp', weight: 0.8 },

  // Recommendation
  { intent: 'recommendation',re: /\b(best|top|recommend|suggest|under\s*\d+|below\s*\d+|cheap(est)?|good)\b/i, signal: 'en-rec', weight: 0.8 },
  { intent: 'recommendation',re: /(সেরা|বেস্ট|টপ|সুপারিশ|recommend|কোনটা কিনব|কোনটি ভাল|টাকার মধ্যে|টাকায়|বাজেট)/i, signal: 'bn-rec', weight: 0.8 },

  // Greeting
  { intent: 'greeting',      re: /^(hi|hello|hey|salam|assalam|হাই|হ্যালো|হেলো|সালাম|আসসালামু|নমস্কার|আদাব)\b/i, signal: 'greet', weight: 0.95 },

  // Follow-up cues
  { intent: 'followup',      re: /^(আরো|আরও|আর|বিস্তারিত|তাহলে|মানে|এর পরে|then|more|else|and)\b/i, signal: 'followup', weight: 0.7 },
];

const QUESTION_MARKS = /[?？]|কি\??$|কী\??$|কেন|কখন|কোথায়|কে|কোন/i;
const PRICE_RE = /(\d+\s*(?:k|হাজার|টাকা|tk|taka|rs|৳)|under\s*\d+|নিচে\s*\d+|মধ্যে\s*\d+)/i;
const NUM_RE = /\d/;
const BN_RE = /[\u0980-\u09FF]/;
const EN_RE = /[A-Za-z]/;

export function detectIntent(text: string): QueryMeta {
  const t = (text || '').trim();
  const signals: string[] = [];
  let best: { intent: QueryIntent; weight: number } = { intent: 'statement', weight: 0 };

  for (const p of PATTERNS) {
    if (p.re.test(t)) {
      signals.push(p.signal);
      if (p.weight > best.weight) best = { intent: p.intent, weight: p.weight };
    }
  }

  const isQuestion = QUESTION_MARKS.test(t);
  // If no pattern fired but it's a question, classify as 'question'
  if (best.weight === 0 && isQuestion) {
    best = { intent: 'question', weight: 0.5 };
    signals.push('q-mark');
  }

  const hasBn = BN_RE.test(t), hasEn = EN_RE.test(t);
  const language: QueryMeta['language'] =
    hasBn && hasEn ? 'mixed' : hasBn ? 'bn' : 'en';

  return {
    intent: best.intent,
    confidence: best.weight,
    signals,
    isQuestion,
    hasNumber: NUM_RE.test(t),
    hasPriceRange: PRICE_RE.test(t),
    language,
  };
}
