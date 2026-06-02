/**
 * Sofia Intelligence Layer v3 — public facade
 *
 * Phase 1:  Query Understanding      (queryUnderstanding.ts)
 * Phase 2:  Knowledge Graph          (knowledgeGraph.ts)
 * Phase 3:  Synonym Engine           (synonymEngine.ts)
 * Phase 4:  Rule-Based Reasoning     (reasoningEngine.ts)  ← NEW
 * Phase 5:  Multi-Stage Retrieval    (rankingPipeline.ts)
 * Phase 6:  Adaptive Scoring         (adaptiveScoring.ts + feedbackLearning.ts)
 * Phase 7:  Explanation Engine       (explanationEngine.ts) ← NEW
 * Phase 8:  Short-Term Memory        (contextMemory.ts)
 * Phase 9:  Long-Term Memory         (contextMemory.ts)
 * Phase 10: Self-Learning            (feedbackLearning.ts + adaptiveScoring.ts)
 * Phase 11: Knowledge Building       (knowledgeBuilder.ts)  ← NEW
 * Phase 12: Smart Suggestions        (suggestions.ts)       ← NEW
 * Phase 13: LRU Cache                (lruCache.ts)
 * Phase 14: Multilingual             (synonymEngine + knowledgeGraph)
 * Phase 15: Performance              (lazy init, LRU)
 */

import { detectIntent, type QueryMeta }           from './queryUnderstanding';
import { normalize, type NormalizeResult }         from './normalizer';
import { expandWithSynonyms, type ExpandedQuery }  from './synonymEngine';
import { buildDefaultGraph, KnowledgeGraph }       from './knowledgeGraph';
import { ContextMemory }                           from './contextMemory';
import { rank, type RawCandidate, type RankedResult } from './rankingPipeline';
import { reinforce, penalize, getAllWeights, resetWeights } from './adaptiveScoring';
import { recordEvent, feedbackBoost, topClicked, topQueries, clearFeedback, snapshot } from './feedbackLearning';
import { LRUCache }                                from './lruCache';
import { ReasoningEngine, type ReasoningResult }   from './reasoningEngine';
import { generateExplanation, type Explanation }   from './explanationEngine';
import { getSuggestions, recordQuery, getTrending, clearSuggestions, getSuggestionStats } from './suggestions';
import { buildKnowledgeFromText, buildFromQABatch } from './knowledgeBuilder';

export interface UnderstoodQuery {
  raw: string;
  meta: QueryMeta;
  normalized: NormalizeResult;
  expanded: ExpandedQuery;
  contextualText: string;
  reasoning: ReasoningResult;    // Phase 4
}

export interface IntelligenceAPI {
  // Core
  understand: (text: string) => UnderstoodQuery;
  rankCandidates: (candidates: RawCandidate[], uq: UnderstoodQuery) => RankedResult[];
  explain: (result: RankedResult, uq: UnderstoodQuery, lang?: 'bn' | 'en') => Explanation;  // Phase 7

  // Memory hooks
  recordTurn: (q: string, a: string, category: string, topicTokens: string[]) => void;

  // Feedback hooks (Phase 6 + 10)
  recordShown:   (q: string, key: string | null) => void;
  recordClick:   (q: string, key: string | null, engines: string[]) => void;
  recordIgnore:  (q: string, key: string | null, engines: string[]) => void;

  // Suggestions (Phase 12)
  getSuggestions: (prefix: string, allQA: Array<{ originalQuestions: string[] }>, limit?: number) => string[];
  getTrending: (limit?: number) => string[];
  recordQuery: (query: string) => void;

  // Knowledge building (Phase 11)
  buildKnowledge: (text: string) => void;
  buildFromQABatch: (items: Array<{ originalQuestions: string[]; answer: string }>, max?: number) => number;

  // Cache
  cacheGet: (q: string) => RankedResult[] | undefined;
  cacheSet: (q: string, results: RankedResult[]) => void;
  clearCaches: () => void;

  // Diagnostics + maintenance
  getDiagnostics: () => {
    weights: ReturnType<typeof getAllWeights>;
    memory: ReturnType<ContextMemory['snapshot']> & { usage: number };
    feedback: { topQueries: ReturnType<typeof topQueries>; topClicked: ReturnType<typeof topClicked> };
    cache: { result: ReturnType<LRUCache<string, unknown>['stats']>; query: ReturnType<LRUCache<string, unknown>['stats']> };
    graphSize: number;
    graph: ReturnType<KnowledgeGraph['serialize']>;
    suggestions: ReturnType<typeof getSuggestionStats>;
    rules: ReturnType<ReasoningEngine['getRules']>;
  };
  resetLearning: () => void;
  graph: KnowledgeGraph;
  memory: ContextMemory;
  reasoning: ReasoningEngine;
}

export function createIntelligence(userSyn: Record<string, string[]> = {}): IntelligenceAPI {
  const graph   = buildDefaultGraph();
  const memory  = new ContextMemory();
  const reasoner = new ReasoningEngine();
  const resultCache = new LRUCache<string, RankedResult[]>(80, 'results');
  const queryCache  = new LRUCache<string, UnderstoodQuery>(120, 'queries');

  function understand(text: string): UnderstoodQuery {
    const cached = queryCache.get(text);
    if (cached) return cached;

    const meta = detectIntent(text);
    const norm = normalize(text);
    const isFollowUp = meta.intent === 'followup' || norm.tokens.length <= 2;
    const contextualText = memory.resolveFollowUp(text, isFollowUp);
    const finalNorm = contextualText !== text ? normalize(contextualText) : norm;
    const expanded = expandWithSynonyms(finalNorm.tokens, userSyn);

    // Phase 4: Run reasoning
    const reasoning = reasoner.reason({
      query: text,
      intent: meta.intent,
      language: meta.language,
      tokens: norm.tokens,
    });

    const uq: UnderstoodQuery = { raw: text, meta, normalized: finalNorm, expanded, contextualText, reasoning };
    queryCache.set(text, uq);
    return uq;
  }

  function rankCandidates(candidates: RawCandidate[], uq: UnderstoodQuery): RankedResult[] {
    const ranked = rank({
      candidates,
      currentTopic: memory.getCurrentTopic(),
      topicTokens: memory.getTopicTokens(),
      expandedTokens: uq.expanded.all,
      exactTokens: uq.expanded.exact,
      graph,
      allQueryTokens: uq.normalized.tokens,
    });

    // Phase 4: Apply reasoning category boost
    return ranked.map(r => {
      const boost = reasoner.getCategoryBoost(uq.reasoning.conclusions, r.item.category || '');
      return boost > 1 ? { ...r, finalScore: r.finalScore * boost } : r;
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  function explain(result: RankedResult, uq: UnderstoodQuery, lang: 'bn' | 'en' = 'bn'): Explanation {
    return generateExplanation(result, uq.reasoning, lang);
  }

  function recordTurn(q: string, a: string, category: string, topicTokens: string[]) {
    memory.pushTurn({ q, a, category, topicTokens, ts: Date.now() });
  }

  function recordShown(q: string, key: string | null) {
    if (key) recordEvent({ query: q, resultKey: key, kind: 'shown' });
  }
  function recordClick(q: string, key: string | null, engines: string[]) {
    if (key) recordEvent({ query: q, resultKey: key, kind: 'clicked' });
    reinforce(engines as never);
  }
  function recordIgnore(q: string, key: string | null, engines: string[]) {
    if (key) recordEvent({ query: q, resultKey: key, kind: 'ignored' });
    penalize(engines as never);
  }

  return {
    understand, rankCandidates, explain,
    recordTurn, recordShown, recordClick, recordIgnore,

    // Phase 12
    getSuggestions: (prefix, allQA, limit) => getSuggestions(prefix, allQA, limit),
    getTrending,
    recordQuery,

    // Phase 11
    buildKnowledge: (text) => buildKnowledgeFromText(text, graph),
    buildFromQABatch: (items, max = 50) => buildFromQABatch(items, graph, max),

    // Cache
    cacheGet: (q) => resultCache.get(q),
    cacheSet: (q, r) => resultCache.set(q, r),
    clearCaches: () => { resultCache.clear(); queryCache.clear(); },

    // Diagnostics
    getDiagnostics: () => ({
      weights: getAllWeights(),
      memory: {
        ...memory.snapshot(),
        usage: JSON.stringify(memory.snapshot()).length + JSON.stringify(graph.serialize()).length,
      },
      feedback: { topQueries: topQueries(20), topClicked: topClicked(20), full: snapshot() },
      cache: { result: resultCache.stats(), query: queryCache.stats() },
      graphSize: graph.size(),
      graph: graph.serialize(),
      suggestions: getSuggestionStats(),
      rules: reasoner.getRules(),
    }),
    resetLearning: () => {
      resetWeights(); clearFeedback(); memory.clear();
      resultCache.clear(); queryCache.clear(); clearSuggestions();
    },
    graph, memory, reasoning: reasoner,
  };
}

export type { RawCandidate, RankedResult } from './rankingPipeline';
export type { EngineName } from './adaptiveScoring';
