import { tokenize } from './textProcessing';
import type { QAItem } from '../types/sofia';

export type CoMatrix = Record<string, Record<string, number>>;

/** Build co-occurrence matrix from QA data */
export function buildCoOccurrence(qa: QAItem[], winSize = 3): CoMatrix {
  const mat: CoMatrix = {};
  qa.forEach(item => {
    const tokens = tokenize((item.processedQuestions || []).join(' ') + ' ' + item.answer);
    tokens.forEach((t, i) => {
      if (!mat[t]) mat[t] = {};
      for (let j = Math.max(0, i - winSize); j < Math.min(tokens.length, i + winSize + 1); j++) {
        if (i === j) continue;
        mat[t][tokens[j]] = (mat[t][tokens[j]] || 0) + 1;
      }
    });
  });
  return mat;
}

/** Expand query using synonyms and co-occurrence neighbors */
export function expandQuery(
  tokens: string[],
  synMap: Record<string, string[]>,
  coMatrix: CoMatrix,
  enabled: boolean
): string[] {
  if (!enabled) return tokens;
  const expanded = [...tokens];
  tokens.forEach(t => {
    Object.entries(synMap).forEach(([canon, syns]) => {
      if (t === canon) (syns || []).slice(0, 2).forEach(s => expanded.push(s.toLowerCase()));
      if ((syns || []).map(s => s.toLowerCase()).includes(t)) expanded.push(canon.toLowerCase());
    });
    const neighbors = Object.entries(coMatrix[t] || {})
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
    expanded.push(...neighbors);
  });
  return [...new Set(expanded)];
}
