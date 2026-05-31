/**
 * Phase 8 — Multi-Stage Ranking Pipeline
 *
 * Stages:
 *   1. Search candidates from every engine (caller-provided)
 *   2. Merge per item
 *   3. Context boost
 *   4. Synonym boost
 *   5. Knowledge-graph boost
 *   6. User-feedback boost
 *   7. Sort + return
 *
 * Pure function — accepts inputs, returns ranked output. No side effects
 * except for feedbackBoost lookups (read-only).
 */

import type { QAItem } from '../../types/sofia';
import { getWeight, type EngineName } from './adaptiveScoring';
import { feedbackBoost } from './feedbackLearning';
import { KnowledgeGraph } from './knowledgeGraph';

export interface RawCandidate {
  item: QAItem;
  score: number;       // raw engine score
  engine: EngineName;
}

export interface RankedResult {
  item: QAItem;
  finalScore: number;
  engines: EngineName[];
  breakdown: {
    base: number;
    contextBoost: number;
    synonymBoost: number;
    graphBoost: number;
    feedbackBoost: number;
    voteBonus: number;
  };
}

export interface RankInputs {
  candidates: RawCandidate[];
  currentTopic?: string | null;
  topicTokens?: string[];
  expandedTokens?: string[];   // synonym-expanded tokens (for syn boost)
  exactTokens?: string[];      // original tokens
  graph?: KnowledgeGraph;
  allQueryTokens?: string[];   // for graph match
}

export function rank(inputs: RankInputs): RankedResult[] {
  const { candidates, currentTopic, expandedTokens = [], exactTokens = [],
          graph, allQueryTokens = [] } = inputs;

  // Stage 2 — merge per-item
  const merged = new Map<string, {
    item: QAItem; score: number; engines: EngineName[];
  }>();
  for (const c of candidates) {
    const k = c.item?.firebaseKey || JSON.stringify(c.item?.originalQuestions);
    const entry = merged.get(k) || { item: c.item, score: 0, engines: [] };
    entry.score += c.score * getWeight(c.engine);
    entry.engines.push(c.engine);
    merged.set(k, entry);
  }

  // Stages 3-6 — boosts
  const ranked: RankedResult[] = [];
  for (const v of merged.values()) {
    const base = v.score;

    // 3. Context boost — matches active topic / category
    const ctxBoost = currentTopic && v.item.category === currentTopic ? 1.3 : 1.0;

    // 4. Synonym boost — does candidate text contain expanded (non-exact) tokens?
    let synBoost = 1.0;
    if (expandedTokens.length) {
      const itemText = ((v.item.processedQuestions || []).join(' ') + ' ' +
                        (v.item.originalQuestions || []).join(' ')).toLowerCase();
      const exactSet = new Set(exactTokens);
      const synOnly = expandedTokens.filter(t => !exactSet.has(t));
      const hits = synOnly.filter(t => itemText.includes(t)).length;
      if (hits > 0) synBoost = 1 + Math.min(0.25, hits * 0.05); // capped
    }

    // 5. Knowledge graph boost
    let graphBoost = 1.0;
    if (graph) {
      const gs = graph.graphScore(allQueryTokens, v.item.category || '', v.item.tags || []);
      graphBoost = 1 + gs * 0.4;
    }

    // 6. User-feedback boost (clicks / ignores)
    const fbBoost = feedbackBoost(v.item.firebaseKey);

    // Vote bonus — more engines agreeing → higher confidence
    const voteBonus = 1 + (v.engines.length - 1) * 0.08;

    const finalScore = base * ctxBoost * synBoost * graphBoost * fbBoost * voteBonus;

    ranked.push({
      item: v.item,
      finalScore,
      engines: [...new Set(v.engines)],
      breakdown: { base, contextBoost: ctxBoost, synonymBoost: synBoost,
                   graphBoost, feedbackBoost: fbBoost, voteBonus },
    });
  }

  // Stage 7 — sort
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  return ranked;
}
