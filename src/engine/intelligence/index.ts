/**
 * Sofia Intelligence Layer — public facade.
 *
 * Combines all 10 phases behind a small API used by queryEngine.ts:
 *
 *   const intel = createIntelligence();
 *   const ctx   = intel.understand(rawText);          // Phase 1+2+7
 *   const cand  = intel.expandedQuery(ctx);           // Phase 3
 *   ... search engines run ...
 *   const ranked = intel.rank({ candidates, ctx });   // Phase 5+8 + graph + feedback
 *   intel.recordShown / recordClick / recordIgnore    // Phase 6
 */

import { detectIntent, type QueryMeta }    from './queryUnderstanding';
import { normalize, type NormalizeResult } from './normalizer';
import { expandWithSynonyms, type ExpandedQuery } from './synonymEngine';
import { buildDefaultGraph, KnowledgeGraph } from './knowledgeGraph';
import { ContextMemory }     from './contextMemory';
import { rank, type RawCandidate, type RankedResult } from './rankingPipeline';
import { reinforce, penalize, getAllWeights, resetWeights } from './adaptiveScoring';
import { recordEvent, feedbackBoost, topClicked, topQueries, clearFeedback, snapshot } from './feedbackLearning';
import { LRUCache } from './lruCache';

export interface UnderstoodQuery {
  raw: string;
  meta: QueryMeta;
  normalized: NormalizeResult;
  expanded: ExpandedQuery;
  contextualText: string;          // text with topic prepended if follow-up
}

export interface IntelligenceAPI {
  understand: (text: string) => UnderstoodQuery;
  rankCandidates: (
    candidates: RawCandidate[],
    uq: UnderstoodQuery,
  ) => RankedResult[];

  // Memory hooks (called by queryEngine after a reply)
  recordTurn: (q: string, a: string, category: string, topicTokens: string[]) => void;

  // Feedback hooks
  recordShown:    (q: string, key: string | null) => void;
  recordClick:    (q: string, key: string | null, engines: string[]) => void;
  recordIgnore:   (q: string, key: string | null, engines: string[]) => void;

  // Cache
  cacheGet: (q: string) => RankedResult[] | undefined;
  cacheSet: (q: string, results: RankedResult[]) => void;
  clearCaches: () => void;

  // Introspection (for dashboard)
  getDiagnostics: () => {
    weights: ReturnType<typeof getAllWeights>;
    memory: ReturnType<ContextMemory['snapshot']>;
    feedback: { topQueries: ReturnType<typeof topQueries>; topClicked: ReturnType<typeof topClicked> };
    cache: { result: ReturnType<LRUCache<string, unknown>['stats']>; query: ReturnType<LRUCache<string, unknown>['stats']> };
    graphSize: number;
  };

  // Maintenance
  resetLearning: () => void;
  graph: KnowledgeGraph;
  memory: ContextMemory;
}

export function createIntelligence(userSyn: Record<string, string[]> = {}): IntelligenceAPI {
  const graph  = buildDefaultGraph();
  const memory = new ContextMemory();
  const resultCache = new LRUCache<string, RankedResult[]>(80);
  const queryCache  = new LRUCache<string, UnderstoodQuery>(120);

  function understand(text: string): UnderstoodQuery {
    const cached = queryCache.get(text);
    if (cached) return cached;

    const meta = detectIntent(text);
    const norm = normalize(text);
    const isFollowUp = meta.intent === 'followup' || norm.tokens.length <= 2;
    const contextualText = memory.resolveFollowUp(text, isFollowUp);
    // Re-normalize the contextual text if we changed it
    const finalNorm = contextualText !== text ? normalize(contextualText) : norm;
    const expanded = expandWithSynonyms(finalNorm.tokens, userSyn);

    const uq: UnderstoodQuery = { raw: text, meta, normalized: finalNorm, expanded, contextualText };
    queryCache.set(text, uq);
    return uq;
  }

  function rankCandidates(candidates: RawCandidate[], uq: UnderstoodQuery): RankedResult[] {
    return rank({
      candidates,
      currentTopic: memory.getCurrentTopic(),
      topicTokens: memory.getTopicTokens(),
      expandedTokens: uq.expanded.all,
      exactTokens: uq.expanded.exact,
      graph,
      allQueryTokens: uq.normalized.tokens,
    });
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
    understand, rankCandidates, recordTurn,
    recordShown, recordClick, recordIgnore,
    cacheGet: (q) => resultCache.get(q),
    cacheSet: (q, r) => resultCache.set(q, r),
    clearCaches: () => { resultCache.clear(); queryCache.clear(); },
    getDiagnostics: () => ({
      weights: getAllWeights(),
      memory: memory.snapshot(),
      feedback: { topQueries: topQueries(), topClicked: topClicked() },
      cache: { result: resultCache.stats(), query: queryCache.stats() },
      graphSize: graph.size(),
    }),
    resetLearning: () => { resetWeights(); clearFeedback(); memory.clear(); resultCache.clear(); queryCache.clear(); void snapshot; },
    graph, memory,
  };
}

export type { RawCandidate, RankedResult } from './rankingPipeline';
export type { EngineName } from './adaptiveScoring';
