/**
 * Universal dataset parser — accepts JSON, JSONL, CSV, TSV, YAML-lite,
 * plain text Q→A pairs, dialog logs, and chat-style conversation arrays.
 * Returns normalized QARecord[] regardless of input shape.
 */
import type { QARecord } from '../hooks/useAdmin';

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function stripHtml(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeItem(raw: any): QARecord | null {
  if (!raw || typeof raw !== 'object') return null;

  // Conversation/messages form: { messages:[{role:'user',content},{role:'assistant',content}] }
  if (Array.isArray(raw.messages) || Array.isArray(raw.conversation) || Array.isArray(raw.turns)) {
    const arr = raw.messages || raw.conversation || raw.turns;
    const userMsgs = arr.filter((m: any) => /user|human|q|question/i.test(m.role || m.from || ''))
      .map((m: any) => String(m.content || m.text || m.message || '').trim()).filter(Boolean);
    const aiMsgs = arr.filter((m: any) => /assistant|bot|ai|a|answer/i.test(m.role || m.from || ''))
      .map((m: any) => String(m.content || m.text || m.message || '').trim()).filter(Boolean);
    if (userMsgs.length && aiMsgs.length) {
      return {
        questions: userMsgs, answer: aiMsgs.join('\n\n'),
        category: raw.category || 'conversation', tags: raw.tags || [],
        feedback: { positive: 0, negative: 0 },
      };
    }
  }

  const questions = asArray(
    raw.questions ?? raw.question ?? raw.q ?? raw.query ?? raw.prompt ?? raw.input ?? raw.user
  ).map((s: any) => stripHtml(String(s))).filter(Boolean);

  const answer = stripHtml(String(
    raw.answer ?? raw.a ?? raw.response ?? raw.reply ?? raw.output ?? raw.assistant ?? raw.bot ?? ''
  ));

  if (!questions.length || !answer) return null;
  return {
    questions,
    answer,
    category: raw.category || raw.cat || raw.topic || 'general',
    tags: Array.isArray(raw.tags) ? raw.tags
      : (raw.tags ? String(raw.tags).split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean) : []),
    feedback: raw.feedback || { positive: 0, negative: 0 },
  };
}

function parseCSV(text: string): any[] {
  const firstLine = text.split('\n')[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',');
  const rows: string[][] = [];
  let cur: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { cur.push(cell); cell = ''; }
      else if (c === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || cur.length) { cur.push(cell); rows.push(cur); }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).filter(r => r.some(c => c.trim())).map(r => {
    const obj: any = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? '');
    return obj;
  });
}

/** Minimal YAML parser supporting `- key: value` lists used in chatbot datasets. */
function parseYAMLLite(text: string): any[] {
  const items: any[] = [];
  const blocks = text.split(/\n(?=- )/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const obj: any = {};
    let curKey: string | null = null;
    let buf: string[] = [];
    const flush = () => { if (curKey) obj[curKey] = buf.join('\n').trim(); buf = []; };
    for (let line of lines) {
      line = line.replace(/^-\s*/, '');
      const m = line.match(/^\s*([a-zA-Z_]\w*)\s*:\s*(.*)$/);
      if (m) {
        flush();
        curKey = m[1].toLowerCase();
        buf = [m[2]];
      } else if (curKey) {
        buf.push(line.trim());
      }
    }
    flush();
    if (Object.keys(obj).length) items.push(obj);
  }
  return items;
}

export interface ParseResult {
  items: QARecord[];
  skipped: number;
  format: string;
  warnings?: string[];
}

export function parseDataset(content: string, filename = ''): ParseResult {
  const trimmed = content.trim();
  if (!trimmed) return { items: [], skipped: 0, format: 'empty' };
  const warnings: string[] = [];

  // JSON / JSONL
  try {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.qa) ? parsed.qa
        : Array.isArray(parsed.qaData) ? parsed.qaData
        : Array.isArray(parsed.data) ? parsed.data
        : Array.isArray(parsed.items) ? parsed.items
        : typeof parsed === 'object' ? Object.values(parsed)
        : [];
      const items = arr.map(normalizeItem).filter(Boolean) as QARecord[];
      return { items, skipped: arr.length - items.length, format: 'json', warnings };
    }
  } catch (e: any) {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) warnings.push(`JSON parse: ${e?.message || 'failed'}`);
  }

  // JSONL
  if (trimmed.includes('\n') && trimmed.split('\n').every(l => {
    const s = l.trim(); return !s || s.startsWith('{') || s.startsWith('[');
  })) {
    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    const arr = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const items = arr.map(normalizeItem).filter(Boolean) as QARecord[];
    if (items.length) return { items, skipped: lines.length - items.length, format: 'jsonl', warnings };
  }

  // YAML-lite
  if (/\.ya?ml$/i.test(filename) || /^-\s+\w+\s*:/m.test(trimmed)) {
    const arr = parseYAMLLite(trimmed);
    const items = arr.map(normalizeItem).filter(Boolean) as QARecord[];
    if (items.length) return { items, skipped: arr.length - items.length, format: 'yaml', warnings };
  }

  // CSV/TSV
  if (/\.(csv|tsv)$/i.test(filename) || /^[^{[].*[,\t;]/.test(trimmed.split('\n')[0])) {
    const arr = parseCSV(trimmed);
    const items = arr.map(normalizeItem).filter(Boolean) as QARecord[];
    if (items.length) return { items, skipped: arr.length - items.length, format: 'csv', warnings };
  }

  // Plain text — Q:/A: blocks, "User:/Bot:", or "Q | A"
  const items: QARecord[] = [];
  const blocks = trimmed.split(/\n\s*\n/);
  let skipped = 0;
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const qLines: string[] = [], aLines: string[] = [];
    let mode: 'q' | 'a' | null = null;
    for (const line of lines) {
      const qm = line.match(/^(?:q|question|user|human|প্রশ্ন)[:\-)]\s*(.+)/i);
      const am = line.match(/^(?:a|answer|bot|assistant|ai|sofia|উত্তর)[:\-)]\s*(.+)/i);
      const pipe = line.match(/^(.+?)\s*[|→=>]+\s*(.+)$/);
      if (qm) { mode = 'q'; qLines.push(qm[1]); }
      else if (am) { mode = 'a'; aLines.push(am[1]); }
      else if (pipe && qLines.length === 0) { qLines.push(pipe[1]); aLines.push(pipe[2]); mode = 'a'; }
      else if (mode === 'q') qLines.push(line);
      else if (mode === 'a') aLines.push(line);
    }
    if (qLines.length && aLines.length) {
      items.push({ questions: qLines, answer: aLines.join('\n'), category: 'general', tags: [], feedback: { positive: 0, negative: 0 } });
    } else if (block.trim()) skipped++;
  }
  return { items, skipped, format: items.length ? 'text' : 'unknown', warnings };
}

/** Diff incoming items vs existing DB. Detects duplicates (same first question
 *  normalized) and near-duplicates (same answer text). */
export interface DedupReport {
  fresh: QARecord[];
  duplicates: { item: QARecord; existingKey: string }[];
  mergeable: { item: QARecord; existingKey: string; newVariants: string[] }[];
}

export function dedupAgainst(items: QARecord[], existing: Record<string, any>): DedupReport {
  const byQ = new Map<string, string>();
  const byA = new Map<string, string>();
  for (const [k, v] of Object.entries(existing || {})) {
    const qs: string[] = Array.isArray((v as any).questions) ? (v as any).questions : [(v as any).question || ''];
    for (const q of qs) if (q) byQ.set(q.trim().toLowerCase(), k);
    if ((v as any).answer) byA.set(String((v as any).answer).trim().toLowerCase(), k);
  }
  const fresh: QARecord[] = [];
  const duplicates: DedupReport['duplicates'] = [];
  const mergeable: DedupReport['mergeable'] = [];
  for (const it of items) {
    const firstQ = (it.questions[0] || '').trim().toLowerCase();
    const ansKey = it.answer.trim().toLowerCase();
    const existsByQ = byQ.get(firstQ);
    const existsByA = byA.get(ansKey);
    if (existsByQ && existsByA && existsByQ === existsByA) {
      duplicates.push({ item: it, existingKey: existsByQ });
    } else if (existsByA) {
      // same answer, new question variants → mergeable
      const existingQs = new Set((existing[existsByA].questions || [existing[existsByA].question]).map((s: string) => s?.trim().toLowerCase()));
      const newVariants = it.questions.filter(q => !existingQs.has(q.trim().toLowerCase()));
      if (newVariants.length) mergeable.push({ item: it, existingKey: existsByA, newVariants });
      else duplicates.push({ item: it, existingKey: existsByA });
    } else {
      fresh.push(it);
    }
  }
  return { fresh, duplicates, mergeable };
}
