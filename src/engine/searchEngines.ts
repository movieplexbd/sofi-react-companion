import { tokenize, phonetic, lev } from './textProcessing';
import type { QAItem } from '../types/sofia';

/* ═══ BM25 Model ═══ */
export interface BM25Model {
  tf: Array<{ t: Record<string, number>; len: number; idx: number }>;
  df: Record<string, number>;
  avgLen: number;
  k1: number;
  b: number;
  N: number;
  qa: QAItem[];
}

export function buildBM25(qa: QAItem[]): BM25Model | null {
  if (!qa?.length) return null;
  const k1 = 1.5, b = 0.75;
  const docs: Array<{ text: string; idx: number }> = [];
  qa.forEach((item, idx) =>
    (item.processedQuestions || []).forEach(q => docs.push({ text: q, idx }))
  );
  if (!docs.length) return null;
  const avgLen = docs.reduce((s, d) => s + tokenize(d.text).length, 0) / docs.length || 1;
  const df: Record<string, number> = {};
  const tf = docs.map(d => {
    const t: Record<string, number> = {};
    const tokens = tokenize(d.text);
    tokens.forEach(w => { t[w] = (t[w] || 0) + 1; df[w] = (df[w] || 0) + 1; });
    return { t, len: tokens.length, idx: d.idx };
  });
  return { tf, df, avgLen, k1, b, N: docs.length, qa };
}

export function bm25Score(qtok: string[], di: number, m: BM25Model): number {
  const doc = m.tf[di]; if (!doc) return 0;
  let s = 0;
  qtok.forEach(w => {
    if (!m.df[w]) return;
    const f = doc.t[w] || 0;
    const idf = Math.log((m.N - m.df[w] + 0.5) / (m.df[w] + 0.5) + 1);
    s += idf * (f * (m.k1 + 1)) / (f + m.k1 * (1 - m.b + m.b * (doc.len / m.avgLen)));
  });
  return s;
}

/** BM25F — Field weighted scoring */
export function bm25FScore(qtok: string[], item: QAItem): number {
  const fields = [
    { text: (item.processedQuestions || []).join(' '), w: 2.0 },
    { text: item.answer || '', w: 0.4 },
    { text: (item.tags || []).join(' '), w: 1.5 },
    { text: item.category || '', w: 0.8 },
  ];
  let total = 0;
  fields.forEach(({ text, w }) => {
    const toks = tokenize(text), len = toks.length || 1;
    const tf: Record<string, number> = {};
    toks.forEach(t => (tf[t] = (tf[t] || 0) + 1));
    qtok.forEach(q => { if (tf[q]) total += (tf[q] / len) * w; });
  });
  return total;
}

/* ═══ TF-IDF Model ═══ */
export interface TFIDFModel {
  docs: Array<{ tokens: string[]; item: QAItem }>;
  df: Record<string, number>;
  N: number;
}

export function buildTFIDF(qa: QAItem[]): TFIDFModel | null {
  if (!qa?.length) return null;
  const docs = qa.map(item => ({
    tokens: tokenize((item.processedQuestions || []).join(' ')),
    item,
  }));
  const df: Record<string, number> = {};
  docs.forEach(d => [...new Set(d.tokens)].forEach(t => (df[t] = (df[t] || 0) + 1)));
  return { docs, df, N: docs.length };
}

export function tfidfBest(
  utxt: string, model: TFIDFModel, threshold: number
): { item: QAItem; score: number } | null {
  const qt = tokenize(utxt);
  if (!qt.length) return null;
  let best: QAItem | null = null, bs = -1;
  model.docs.forEach(({ tokens, item }) => {
    let s = 0;
    qt.forEach(q => {
      const tf = tokens.filter(t => t === q).length / (tokens.length || 1);
      const idf = Math.log((model.N + 1) / ((model.df[q] || 0) + 1)) + 1;
      s += tf * idf;
    });
    s /= qt.length || 1;
    if (s > bs) { bs = s; best = item; }
  });
  return bs >= threshold && best ? { item: best, score: bs * 100 } : null;
}

/* ═══ N-gram ═══ */
export function ngrams(toks: string[], n = 2): string[] {
  const g: string[] = [];
  for (let i = 0; i <= toks.length - n; i++) g.push(toks.slice(i, i + n).join('_'));
  return g;
}

export function ngramSim(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const uB = new Set(ngrams(a, 2)), dB = new Set(ngrams(b, 2));
  const uU = new Set(a), dU = new Set(b);
  const bm = [...uB].filter(g => dB.has(g)).length;
  const um = [...uU].filter(w => dU.has(w)).length;
  const d = uB.size + uU.size;
  return d > 0 ? (bm * 2 + um) / d : 0;
}

/* ═══ Jaccard ═══ */
export function jaccard(a: string[], b: string[]): number {
  const sA = new Set(a), sB = new Set(b);
  const inter = [...sA].filter(x => sB.has(x)).length;
  const union = new Set([...sA, ...sB]).size;
  return union > 0 ? inter / union : 0;
}

/* ═══ Fuzzy search ═══ */
export function fuzzyBest(
  original: string, qa: QAItem[], threshold: number
): { item: QAItem; score: number } | null {
  if (original.trim().length < 4) return null;
  let bs = -1;
  let bi: QAItem | null = null;
  const uL = original.toLowerCase().trim();
  qa.forEach(item =>
    (item.originalQuestions || []).forEach(q => {
      const sim = 1 - lev(uL, q.toLowerCase().trim()) / Math.max(uL.length, q.length, 1);
      if (sim > bs) { bs = sim; bi = item; }
    })
  );
  return bs >= threshold && bi ? { item: bi, score: bs * 70 } : null;
}

/* ═══ Phonetic search ═══ */
export function phoneticBest(
  original: string, qa: QAItem[], threshold: number
): { item: QAItem; score: number } | null {
  if (original.trim().length < 4) return null;
  let bs = -1;
  let bi: QAItem | null = null;
  const uPh = phonetic(original.toLowerCase());
  qa.forEach(item =>
    (item.originalQuestions || []).forEach(q => {
      const qPh = phonetic(q.toLowerCase());
      const sim = 1 - lev(uPh, qPh) / Math.max(uPh.length, qPh.length, 1);
      if (sim > bs) { bs = sim; bi = item; }
    })
  );
  return bs >= threshold && bi ? { item: bi, score: bs * 65 } : null;
}
