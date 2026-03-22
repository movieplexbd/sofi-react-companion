import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update, push, set, serverTimestamp } from 'firebase/database';
import type { Database } from 'firebase/database';
import { firebaseConfig } from '../constants/firebaseConfig';
import { synonymReplace } from '../engine/textProcessing';
import type { DataStore, QAItem } from '../types/sofia';

const DEFAULT_CFG = {
  botName: 'Sofia', version: '4.0', language: 'bn',
  searchWeights: { bm25: 0.35, tfidf: 0.25, ngram: 0.15, fuzzy: 0.10, phonetic: 0.08, jaccard: 0.07 },
  thresholds: { bm25: 1.8, tfidf: 0.07, ngram: 0.12, fuzzy: 0.60, phonetic: 0.68, jaccard: 0.20, lowConfidence: 35, highConfidence: 70 },
  features: {
    bm25Enabled: true, tfidfEnabled: true, ngramEnabled: true, fuzzyEnabled: true,
    phoneticEnabled: true, jaccardEnabled: true, learningEnabled: true, markdownEnabled: true,
    sentimentEnabled: true, contextEnabled: true, entityEnabled: true, mathEnabled: true,
    timeEnabled: true, adaptiveLearning: true, relatedQuestions: true, spellCorrect: true,
    queryExpansion: true, answerChunking: true, analyticsEnabled: true,
  },
};

export interface BootStep {
  id: number;
  text: string;
  status: 'pending' | 'active' | 'done';
}

export function useFirebase() {
  const [data, setData] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootSteps, setBootSteps] = useState<BootStep[]>([
    { id: 1, text: 'Firebase সংযোগ...', status: 'active' },
    { id: 2, text: 'QA ডেটা লোড...', status: 'pending' },
    { id: 3, text: 'BM25 + TF-IDF মডেল তৈরি...', status: 'pending' },
    { id: 4, text: 'Co-occurrence Vectors...', status: 'pending' },
    { id: 5, text: 'Intent + Entity লোড...', status: 'pending' },
    { id: 6, text: 'শেষ প্রস্তুতি...', status: 'pending' },
  ]);
  const [bootProgress, setBootProgress] = useState(0);
  const dbRef = useRef<Database | null>(null);

  const updateStep = useCallback((stepNum: number, progress: number) => {
    setBootSteps(prev =>
      prev.map(s => ({
        ...s,
        status: s.id < stepNum ? 'done' : s.id === stepNum ? 'active' : 'pending',
      }))
    );
    setBootProgress(progress);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        dbRef.current = db;

        updateStep(1, 10);
        await new Promise(r => setTimeout(r, 200));

        const paths = ['qaData', 'synonymMap', 'intents', 'contextRules', 'entities', 'responseTemplates', 'sentimentLexicon', 'botConfig', 'spellCorrections'];
        const snaps = await Promise.all(paths.map(p => get(ref(db, p))));
        const [qaS, synS, intS, ctxS, entS, tplS, sentS, cfgS, spellS] = snaps;

        if (cancelled) return;
        updateStep(2, 30);

        const syn = synS.exists() ? synS.val() || {} : {};
        let qa: QAItem[] = [];
        if (qaS.exists()) {
          qa = Object.entries(qaS.val()).map(([k, v]: [string, any]) => ({
            firebaseKey: k,
            originalQuestions: Array.isArray(v.questions) ? v.questions : [v.question || ''],
            processedQuestions: (Array.isArray(v.questions) ? v.questions : [v.question || '']).map((q: string) => synonymReplace(q, syn)),
            answer: v.answer || '', category: v.category || 'general', tags: v.tags || [],
            feedback: v.feedback || { positive: 0, negative: 0 },
          })).filter(i => i.answer);
        }

        updateStep(3, 50);
        updateStep(4, 68);
        updateStep(5, 82);

        const int = intS.exists() ? intS.val() || {} : {};
        const ctx = ctxS.exists() ? ctxS.val() || {} : {};
        const ent = entS.exists() ? entS.val() || {} : {};
        const tpl = tplS.exists() ? tplS.val() || {} : {};
        const sentLex = { positive: [], negative: [], urgent: [], confused: [], ...(sentS.exists() ? sentS.val() || {} : {}) };
        const spell = spellS.exists() ? spellS.val() || {} : {};
        let cfg = { ...DEFAULT_CFG };
        if (cfgS.exists()) {
          const c = cfgS.val();
          cfg = {
            ...cfg, ...c,
            searchWeights: { ...cfg.searchWeights, ...(c.searchWeights || {}) },
            thresholds: { ...cfg.thresholds, ...(c.thresholds || {}) },
            features: { ...cfg.features, ...(c.features || {}) },
          };
        }

        updateStep(6, 95);
        await new Promise(r => setTimeout(r, 200));

        if (cancelled) return;
        setData({ qa, syn, int, ctx, ent, tpl, spell, sent: sentLex, cfg });
        setBootProgress(100);
        setBootSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
        setTimeout(() => setLoading(false), 400);
      } catch (e: any) {
        console.error('Load error:', e);
        if (!cancelled) setError(e.message || 'Failed to load data');
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [updateStep]);

  const handleFeedback = useCallback(async (firebaseKey: string, isPositive: boolean, userQ?: string) => {
    const db = dbRef.current;
    if (!db) return;
    try {
      const snap = await get(ref(db, `qaData/${firebaseKey}/feedback`));
      const cur = snap.exists() ? snap.val() : { positive: 0, negative: 0 };
      await update(ref(db, `qaData/${firebaseKey}/feedback`), {
        [isPositive ? 'positive' : 'negative']: (cur[isPositive ? 'positive' : 'negative'] || 0) + 1,
      });
    } catch (e) { console.error(e); }
  }, []);

  return { data, loading, error, bootSteps, bootProgress, db: dbRef.current, handleFeedback };
}
