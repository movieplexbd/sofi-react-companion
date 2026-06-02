/**
 * useAdmin — Master control hook for Firebase Realtime DB.
 * Full CRUD + bulk operations + snapshot/restore.
 */
import { useCallback, useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, set, update, remove, push } from 'firebase/database';
import { firebaseConfig } from '../constants/firebaseConfig';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

export type CollectionName =
  | 'qaData' | 'synonymMap' | 'intents' | 'contextRules'
  | 'entities' | 'responseTemplates' | 'sentimentLexicon'
  | 'botConfig' | 'spellCorrections';

export const ALL_COLLECTIONS: CollectionName[] = [
  'qaData','synonymMap','intents','contextRules','entities',
  'responseTemplates','sentimentLexicon','botConfig','spellCorrections',
];

export interface QARecord {
  questions: string[];
  answer: string;
  category?: string;
  tags?: string[];
  feedback?: { positive: number; negative: number };
}

export function useAdmin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<Record<CollectionName, any>>({
    qaData: {}, synonymMap: {}, intents: {}, contextRules: {},
    entities: {}, responseTemplates: {}, sentimentLexicon: {},
    botConfig: {}, spellCorrections: {},
  } as any);

  const reload = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const snaps = await Promise.all(ALL_COLLECTIONS.map(p => get(ref(db, p))));
      const next: any = {};
      ALL_COLLECTIONS.forEach((p, i) => { next[p] = snaps[i].exists() ? snaps[i].val() || {} : {}; });
      setAll(next);
    } catch (e: any) { setError(e?.message || 'load failed'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ---- QA CRUD ----
  const addQA = useCallback(async (qa: QARecord) => {
    const key = push(ref(db, 'qaData')).key!;
    await set(ref(db, `qaData/${key}`), {
      ...qa, feedback: qa.feedback || { positive: 0, negative: 0 },
    });
    return key;
  }, []);

  const updateQA = useCallback(async (key: string, patch: Partial<QARecord>) => {
    await update(ref(db, `qaData/${key}`), patch);
  }, []);

  const deleteQA = useCallback(async (key: string) => {
    await remove(ref(db, `qaData/${key}`));
  }, []);

  const bulkAddQA = useCallback(async (items: QARecord[], onProgress?: (n: number, total: number) => void) => {
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      try { await addQA(items[i]); ok++; } catch (e) { console.error(e); }
      onProgress?.(i + 1, items.length);
    }
    return ok;
  }, [addQA]);

  const bulkDeleteQA = useCallback(async (keys: string[], onProgress?: (n: number, total: number) => void) => {
    let ok = 0;
    for (let i = 0; i < keys.length; i++) {
      try { await deleteQA(keys[i]); ok++; } catch (e) { console.error(e); }
      onProgress?.(i + 1, keys.length);
    }
    return ok;
  }, [deleteQA]);

  const bulkUpdateCategory = useCallback(async (keys: string[], category: string) => {
    await Promise.all(keys.map(k => update(ref(db, `qaData/${k}`), { category })));
  }, []);

  /** Append new question variants to an existing QA. */
  const mergeIntoQA = useCallback(async (key: string, newVariants: string[]) => {
    const snap = await get(ref(db, `qaData/${key}`));
    if (!snap.exists()) return;
    const cur = snap.val();
    const existing = Array.isArray(cur.questions) ? cur.questions : [cur.question || ''];
    const seen = new Set(existing.map((s: string) => s.trim().toLowerCase()));
    const merged = [...existing];
    for (const v of newVariants) if (!seen.has(v.trim().toLowerCase())) merged.push(v);
    await update(ref(db, `qaData/${key}`), { questions: merged });
  }, []);

  /** Find & replace across all qa answers (and optionally questions). */
  const findReplace = useCallback(async (find: string, replaceWith: string, opts: { inAnswers?: boolean; inQuestions?: boolean; caseSensitive?: boolean; regex?: boolean } = {}) => {
    const { inAnswers = true, inQuestions = false, caseSensitive = false, regex = false } = opts;
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = regex ? new RegExp(find, flags) : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const snap = await get(ref(db, 'qaData'));
    if (!snap.exists()) return 0;
    const data = snap.val();
    let touched = 0;
    for (const [k, v] of Object.entries<any>(data)) {
      const patch: any = {};
      if (inAnswers && typeof v.answer === 'string' && pattern.test(v.answer)) {
        patch.answer = v.answer.replace(pattern, replaceWith); touched++;
      }
      if (inQuestions && Array.isArray(v.questions)) {
        const updated = v.questions.map((q: string) => q.replace(pattern, replaceWith));
        if (JSON.stringify(updated) !== JSON.stringify(v.questions)) {
          patch.questions = updated; touched++;
        }
      }
      if (Object.keys(patch).length) await update(ref(db, `qaData/${k}`), patch);
    }
    return touched;
  }, []);

  // ---- Generic key/value CRUD ----
  const setNode = useCallback(async (path: string, value: any) => {
    await set(ref(db, path), value);
  }, []);
  const removeNode = useCallback(async (path: string) => {
    await remove(ref(db, path));
  }, []);
  const updateNode = useCallback(async (path: string, patch: any) => {
    await update(ref(db, path), patch);
  }, []);

  // ---- Snapshot / Restore ----
  const snapshot = useCallback(async () => {
    const snaps = await Promise.all(ALL_COLLECTIONS.map(p => get(ref(db, p))));
    const out: any = { _meta: { createdAt: Date.now(), version: 'sofia-snapshot-1' } };
    ALL_COLLECTIONS.forEach((p, i) => { out[p] = snaps[i].exists() ? snaps[i].val() : {}; });
    return out;
  }, []);

  const restore = useCallback(async (data: any, mode: 'replace' | 'merge' = 'merge') => {
    if (!data || typeof data !== 'object') throw new Error('Invalid snapshot');
    for (const p of ALL_COLLECTIONS) {
      if (!(p in data)) continue;
      if (mode === 'replace') {
        await set(ref(db, p), data[p] || null);
      } else {
        await update(ref(db, p), data[p] || {});
      }
    }
  }, []);

  return {
    db, busy, error, all, reload,
    addQA, updateQA, deleteQA, bulkAddQA, bulkDeleteQA, bulkUpdateCategory, mergeIntoQA, findReplace,
    setNode, removeNode, updateNode,
    snapshot, restore,
  };
}
