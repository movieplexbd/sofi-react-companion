/**
 * Phase 5 — Adaptive Scoring
 *
 * Maintains per-engine weights that drift over time based on which engine
 * produced answers the user actually engaged with (clicked / followed-up).
 *
 * Weights are persisted to localStorage and clamped to a safe range so
 * one engine can never fully dominate.
 */

const KEY = 'sofia_adaptive_weights_v1';

export type EngineName =
  | 'BM25' | 'BM25F' | 'TF-IDF' | 'N-gram' | 'Fuzzy'
  | 'Phonetic' | 'Jaccard' | 'Substring'
  | 'KnowledgeGraph' | 'Context';

const DEFAULT_WEIGHTS: Record<EngineName, number> = {
  BM25:           1.0,
  BM25F:          1.2,
  'TF-IDF':       0.9,
  'N-gram':       0.8,
  Fuzzy:          0.7,
  Phonetic:       0.6,
  Jaccard:        0.7,
  Substring:      0.8,
  KnowledgeGraph: 0.5,
  Context:        0.6,
};

const MIN = 0.2, MAX = 2.5, STEP = 0.04;

function load(): Record<EngineName, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_WEIGHTS };
}
function save(w: Record<EngineName, number>) {
  try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* quota */ }
}

let weights = load();

export function getWeight(engine: EngineName): number {
  return weights[engine] ?? 0.5;
}

export function getAllWeights() { return { ...weights }; }

/**
 * Reward the engines that produced the chosen result. Each "winning" engine
 * gets +STEP, all others decay slightly toward 1.0.
 */
export function reinforce(winnerEngines: EngineName[]) {
  const winners = new Set(winnerEngines);
  for (const k of Object.keys(weights) as EngineName[]) {
    if (winners.has(k)) weights[k] = Math.min(MAX, weights[k] + STEP);
    else weights[k] = weights[k] + (1 - weights[k]) * 0.02; // gentle pull to 1
    weights[k] = Math.max(MIN, weights[k]);
  }
  save(weights);
}

/** When a result was ignored, slightly penalize the engines that surfaced it */
export function penalize(loserEngines: EngineName[]) {
  for (const e of loserEngines) {
    if (weights[e] != null) weights[e] = Math.max(MIN, weights[e] - STEP * 0.5);
  }
  save(weights);
}

export function resetWeights() {
  weights = { ...DEFAULT_WEIGHTS };
  save(weights);
}
