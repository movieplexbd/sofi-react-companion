/**
 * Phase 12 — Smart Suggestions Engine
 *
 * Provides: autocomplete, query suggestions, trending searches,
 * and smart recommendations. Pure local, no external APIs.
 */

const STORAGE_KEY = 'sofia_suggestions_v1';
const MAX_HISTORY = 200;

interface QueryRecord {
  query: string;
  count: number;
  lastTs: number;
}

interface SuggestionStore {
  history: QueryRecord[];
}

function load(): SuggestionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { history: [] };
}

function save(s: SuggestionStore) {
  try {
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

let store: SuggestionStore | null = null;
function ensure(): SuggestionStore { return store ||= load(); }

/** Record a submitted query for trending/suggestions */
export function recordQuery(query: string) {
  if (!query.trim() || query.length < 2) return;
  const s = ensure();
  const norm = query.toLowerCase().trim();
  const existing = s.history.find(r => r.query === norm);
  if (existing) {
    existing.count++;
    existing.lastTs = Date.now();
  } else {
    s.history.push({ query: norm, count: 1, lastTs: Date.now() });
  }
  save(s);
}

/** Autocomplete: prefix match from history */
export function autocomplete(prefix: string, limit = 5): string[] {
  if (!prefix || prefix.length < 2) return [];
  const p = prefix.toLowerCase().trim();
  return ensure().history
    .filter(r => r.query.startsWith(p) && r.query !== p)
    .sort((a, b) => (b.count * 2 + b.lastTs / 1e10) - (a.count * 2 + a.lastTs / 1e10))
    .slice(0, limit)
    .map(r => r.query);
}

/** Trending: most queried in last 7 days */
export function getTrending(limit = 5): string[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return ensure().history
    .filter(r => r.lastTs >= cutoff)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(r => r.query);
}

/** Related: queries that often follow the current one */
export function getRelatedQueries(query: string, allQA: Array<{ originalQuestions: string[] }>, limit = 4): string[] {
  if (!query || !allQA.length) return [];
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);

  // Find QA items whose questions share words with query
  const scored: Array<{ q: string; score: number }> = [];
  for (const item of allQA) {
    for (const question of item.originalQuestions) {
      if (question.toLowerCase() === q) continue;
      const qWords = question.toLowerCase().split(/\s+/);
      const overlap = words.filter(w => qWords.some(qw => qw.includes(w) || w.includes(qw))).length;
      if (overlap > 0) scored.push({ q: question, score: overlap });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.q);
}

/** Smart suggestions combining autocomplete + QA questions */
export function getSuggestions(
  prefix: string,
  allQA: Array<{ originalQuestions: string[] }>,
  limit = 5,
): string[] {
  if (!prefix || prefix.length < 2) return [];
  const p = prefix.toLowerCase().trim();
  const results = new Set<string>();

  // 1. History autocomplete
  for (const s of autocomplete(p, 3)) results.add(s);

  // 2. QA question prefix match
  for (const item of allQA) {
    for (const q of item.originalQuestions) {
      if (q.toLowerCase().startsWith(p) && q !== p) {
        results.add(q);
        if (results.size >= limit) break;
      }
    }
    if (results.size >= limit) break;
  }

  // 3. QA contains match (if not enough results)
  if (results.size < limit) {
    for (const item of allQA) {
      for (const q of item.originalQuestions) {
        if (q.toLowerCase().includes(p) && !results.has(q)) {
          results.add(q);
          if (results.size >= limit) break;
        }
      }
      if (results.size >= limit) break;
    }
  }

  return [...results].slice(0, limit);
}

export function clearSuggestions() {
  store = { history: [] };
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function getSuggestionStats() {
  const s = ensure();
  return {
    totalQueries: s.history.length,
    trending: getTrending(5),
  };
}
