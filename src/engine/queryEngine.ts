import { tokenize, synonymReplace, spellCorrect, phonetic } from './textProcessing';
import {
  buildBM25, bm25Score, bm25FScore, buildTFIDF, tfidfBest,
  ngramSim, jaccard, fuzzyBest, phoneticBest,
  type BM25Model, type TFIDFModel,
} from './searchEngines';
import { buildCoOccurrence, expandQuery, type CoMatrix } from './coOccurrence';
import { detectSentiment, SENT_PREFIXES, type SentimentType } from './sentiment';
import { extractEntities, entityBoost } from './entityExtractor';
import { tryMath } from './mathSolver';
import { tryTimeDate } from './dateTime';
import type { QAItem, DataStore, RuntimeState, AnalyticsEntry } from '../types/sofia';
import { PERSONALITIES } from '../constants/personalities';
import { getDatabase, ref, get, push, set, update, serverTimestamp } from 'firebase/database';
import type { Database } from 'firebase/database';

// Helper functions
const feat = (cfg: DataStore['cfg'], k: string) => cfg.features?.[k] !== false;
const W = (cfg: DataStore['cfg'], k: string) => cfg.searchWeights?.[k] || 0.1;
const TH = (cfg: DataStore['cfg'], k: string) => cfg.thresholds?.[k] || 0.1;

interface SearchCandidate {
  item: QAItem;
  _score: number;
  _method: string;
}

function hybridSearch(
  processed: string, original: string, tokens: string[], expandedToks: string[],
  bm25M: BM25Model | null, tfidfM: TFIDFModel | null, D: DataStore
): SearchCandidate[] {
  const candidates: SearchCandidate[] = [];
  const cfg = D.cfg;

  // 1. BM25
  if (feat(cfg, 'bm25Enabled') && bm25M && bm25M.tf.length) {
    let mx = -1, bi = -1;
    bm25M.tf.forEach((_, i) => { const s = bm25Score(expandedToks, i, bm25M); if (s > mx) { mx = s; bi = i; } });
    if (mx > TH(cfg, 'bm25') && bi !== -1) {
      const item = bm25M.qa[bm25M.tf[bi].idx];
      if (item) candidates.push({ item, _score: mx * 12, _method: 'BM25' });
    }
  }

  // 2. BM25F
  if (feat(cfg, 'bm25Enabled') && D.qa.length) {
    let mx = -1; let bestItem: QAItem | null = null;
    D.qa.forEach(item => { const s = bm25FScore(expandedToks, item); if (s > mx) { mx = s; bestItem = item; } });
    if (mx > 0.05 && bestItem) candidates.push({ item: bestItem, _score: mx * 90, _method: 'BM25F' });
  }

  // 3. TF-IDF
  if (feat(cfg, 'tfidfEnabled') && tfidfM) {
    const r = tfidfBest(processed, tfidfM, TH(cfg, 'tfidf'));
    if (r) candidates.push({ item: r.item, _score: r.score, _method: 'TF-IDF' });
  }

  // 4. N-gram
  if (feat(cfg, 'ngramEnabled') && tokens.length) {
    let bs = -1; let bi: QAItem | null = null;
    D.qa.forEach(item => {
      const dt = tokenize((item.processedQuestions || []).join(' '));
      const s = ngramSim(tokens, dt);
      if (s > bs) { bs = s; bi = item; }
    });
    if (bs >= TH(cfg, 'ngram') && bi) candidates.push({ item: bi, _score: bs * 80, _method: 'N-gram' });
  }

  // 5. Fuzzy
  if (feat(cfg, 'fuzzyEnabled')) {
    const r = fuzzyBest(original, D.qa, TH(cfg, 'fuzzy'));
    if (r) candidates.push({ item: r.item, _score: r.score, _method: 'Fuzzy' });
  }

  // 6. Phonetic
  if (feat(cfg, 'phoneticEnabled')) {
    const r = phoneticBest(original, D.qa, TH(cfg, 'phonetic'));
    if (r) candidates.push({ item: r.item, _score: r.score, _method: 'Phonetic' });
  }

  // 7. Jaccard
  if (feat(cfg, 'jaccardEnabled') && tokens.length) {
    let bs = -1; let bi: QAItem | null = null;
    D.qa.forEach(item => {
      const dt = tokenize((item.processedQuestions || []).join(' '));
      const s = jaccard(tokens, dt);
      if (s > bs) { bs = s; bi = item; }
    });
    if (bs >= TH(cfg, 'jaccard') && bi) candidates.push({ item: bi, _score: bs * 75, _method: 'Jaccard' });
  }

  return candidates;
}

function ensembleVote(
  candidates: SearchCandidate[],
  entities: Record<string, string[]>,
  memory: RuntimeState['memory'],
  cfg: DataStore['cfg']
) {
  const WM: Record<string, number> = {
    'BM25': W(cfg, 'bm25'), 'BM25F': W(cfg, 'bm25') * 0.8,
    'TF-IDF': W(cfg, 'tfidf'), 'N-gram': W(cfg, 'ngram'),
    'Fuzzy': W(cfg, 'fuzzy'), 'Phonetic': W(cfg, 'phonetic'), 'Jaccard': W(cfg, 'jaccard'),
  };
  const map = new Map<string, { item: QAItem; score: number; count: number; methods: string[] }>();
  candidates.forEach(c => {
    const k = c.item?.firebaseKey || JSON.stringify(c.item?.originalQuestions);
    if (!map.has(k)) map.set(k, { item: c.item, score: 0, count: 0, methods: [] });
    const e = map.get(k)!;
    e.score += c._score * (WM[c._method] || 0.1);
    e.count++; e.methods.push(c._method);
  });

  return [...map.values()]
    .map(v => {
      const eb = entityBoost(v.item, entities);
      const mb = memBoost(v.item, memory);
      const voteBonus = 1 + (v.count * 0.15);
      return { ...v, finalScore: v.score * eb * mb * voteBonus };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function memBoost(item: QAItem, memory: RuntimeState['memory']): number {
  let b = 1;
  memory.topics.slice(-3).forEach(t => {
    if (item.category === t || (item.tags || []).includes(t)) b += 0.2;
  });
  return b;
}

function findRelated(item: QAItem, qa: QAItem[], topN = 3): string[] {
  if (qa.length < 3) return [];
  const wt = tokenize((item.processedQuestions || []).join(' '));
  return qa
    .filter(q => q.firebaseKey !== item.firebaseKey)
    .map(q => ({
      q,
      score: jaccard(wt, tokenize((q.processedQuestions || []).join(' '))) +
        (q.category === item.category ? 0.15 : 0),
    }))
    .sort((a, b) => b.score - a.score).slice(0, topN).filter(x => x.score > 0.08)
    .map(x => (x.q.originalQuestions || ['?'])[0]);
}

function recognizeIntent(text: string, intents: DataStore['int']) {
  const sorted = Object.entries(intents).sort((a, b) => (b[1].priority || 5) - (a[1].priority || 5));
  for (const [name, intent] of sorted) {
    for (const pat of (intent.patterns || [])) {
      try { if (new RegExp(pat, 'i').test(text)) return { name, intent }; } catch { /* skip */ }
    }
    for (const kw of (intent.keywords || [])) {
      if (text.toLowerCase().includes(kw.toLowerCase())) return { name, intent };
    }
  }
  return null;
}

function getTpl(tpl: DataStore['tpl'], type: string, vars: Record<string, string> = {}): string | null {
  const list = tpl[type]; if (!list?.length) return null;
  let t = list[Math.floor(Math.random() * list.length)];
  Object.entries(vars).forEach(([k, v]) => (t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '')));
  return t;
}

function applyPersonality(answer: string, personality: string): string {
  const p = PERSONALITIES[personality] || PERSONALITIES.friendly;
  if (personality === 'concise') {
    const lines = answer.split('\n').filter(Boolean);
    if (lines.length > 4) return lines.slice(0, 4).join('\n') + '...';
    if (answer.length > 200) return answer.substring(0, 200) + '...';
  }
  return (p.prefix || '') + answer;
}

function getContextualInput(text: string, history: RuntimeState['history'], enabled: boolean): string {
  if (!enabled || !history.length) return text;
  const followUps = ['আরো', 'বিস্তারিত', 'আরও', 'বলো', 'বলুন', 'কেন', 'কীভাবে', 'কিভাবে', 'explain', 'details', 'why', 'how', 'উদাহরণ'];
  const short = text.trim().split(/\s+/).length <= 4;
  if (short && followUps.some(f => text.toLowerCase().includes(f)))
    return (history.at(-1)?.q || '') + ' ' + text;
  return text;
}

export function chunkAnswer(answer: string, maxLen = 380): { main: string; extra: string | null } {
  if (answer.length <= maxLen) return { main: answer, extra: null };
  for (const bp of ['\n\n', '\n', '। ', '. ']) {
    const idx = answer.lastIndexOf(bp, maxLen);
    if (idx > maxLen * 0.5) return { main: answer.substring(0, idx + bp.length).trim(), extra: answer.substring(idx + bp.length).trim() };
  }
  return { main: answer.substring(0, maxLen) + '...', extra: answer.substring(maxLen) };
}

export interface ReplyResult {
  answer: string;
  firebaseKey?: string | null;
  method?: string | null;
  score?: number;
  sentiment?: SentimentType;
  related?: string[] | null;
  quickReplies?: string[] | null;
  spellCorrected?: boolean;
  originalText?: string | null;
  isMath?: boolean;
}

export interface SofiaEngine {
  getReply: (inputText: string) => Promise<ReplyResult>;
  bm25M: BM25Model | null;
  tfidfM: TFIDFModel | null;
  coMatrix: CoMatrix;
  rebuildModels: () => void;
}

export function createSofiaEngine(
  D: DataStore,
  RT: RuntimeState,
  db: Database | null
): SofiaEngine {
  let bm25M = buildBM25(D.qa);
  let tfidfM = buildTFIDF(D.qa);
  let coMatrix = buildCoOccurrence(D.qa);

  function rebuildModels() {
    bm25M = buildBM25(D.qa);
    tfidfM = buildTFIDF(D.qa);
    coMatrix = buildCoOccurrence(D.qa);
  }

  async function logAnalytics(q: string, method: string | null, score: number) {
    if (!feat(D.cfg, 'analyticsEnabled')) return;
    RT.stats.totalMessages++;
    if (method && score > 0) {
      RT.stats.matchedCount++;
      RT.stats.avgScore = ((RT.stats.avgScore * (RT.stats.matchedCount - 1)) + score) / RT.stats.matchedCount;
    } else RT.stats.noMatchCount++;
    if (!db) return;
    try {
      await push(ref(db, 'conversationLogs'), {
        question: q, method: method || 'none', score: score || 0,
        timestamp: serverTimestamp(), sessionId: RT.sessionId, personality: RT.personality,
      });
    } catch { /* skip */ }
  }

  async function adaptiveLearn(firebaseKey: string, userQ: string, isPositive: boolean) {
    if (!feat(D.cfg, 'adaptiveLearning') || !isPositive || !userQ || !db) return;
    try {
      const snap = await get(ref(db, `qaData/${firebaseKey}/questions`));
      const existing = snap.exists() ? snap.val() : [];
      const norm = userQ.toLowerCase().trim();
      if (!existing.includes(norm) && norm.length > 4) {
        await update(ref(db, `qaData/${firebaseKey}`), { questions: [...existing, norm] });
        const item = D.qa.find(q => q.firebaseKey === firebaseKey);
        if (item) {
          item.originalQuestions.push(norm);
          item.processedQuestions.push(synonymReplace(norm, D.syn));
          rebuildModels();
        }
      }
    } catch (e) { console.error('Adaptive learn:', e); }
  }

  function handleIntent(det: { name: string; intent: DataStore['int'][string] }): string | null {
    const { intent, name } = det;
    if (intent.action === 'repeat_last_answer' && RT.lastAnswer) return RT.lastAnswer;
    if (intent.action === 'start_teach_mode') { RT.state = 'awaiting_answer'; return getTpl(D.tpl, 'teach_prompt') || '✏️ উত্তর লিখো:'; }
    if (intent.action === 'show_help') return getHelpMsg();
    const res = intent.responses || [];
    if (res.length) return res[Math.floor(Math.random() * res.length)];
    const n = D.cfg.botName || 'Sofia';
    if (name === 'greet') return `হ্যালো${RT.userName ? ' **' + RT.userName + '**' : ''}! 👋 আমি **${n}**। কিভাবে সাহায্য করতে পারি?`;
    if (name === 'bye') return 'আবার আসবে! 👋 ভালো থেকো।';
    if (name === 'thanks') return 'স্বাগতম! 🙏 আর কিছু জানতে চাইলে বলো।';
    if (name === 'help') return getHelpMsg();
    if (name === 'name_query') return `আমি **${n}** v${D.cfg.version || '4.0'} — একটি Ultra Intelligent বাংলা AI 🤖`;
    return null;
  }

  function getHelpMsg(): string {
    const n = D.cfg.botName || 'Sofia';
    return `### 🤖 ${n} v${D.cfg.version || '4.0'} — আমি যা পারি:\n\n- 💬 **যেকোনো প্রশ্নের উত্তর** (${D.qa.length} QA database)\n- 🔢 **গণিত** (2+2, ৫×৬, শতাংশ)\n- 📅 **তারিখ ও সময়**\n- 🧠 **Context মনে রাখা**\n- 📚 **নতুন কিছু শেখা**\n\n*যা জানি না সেটা শিখিয়ে দাও!*`;
  }

  function wrapResponse(answer: string, score: number): string {
    if (!score || score === 100) return answer;
    const lo = TH(D.cfg, 'lowConfidence');
    if (score < lo) {
      const t = getTpl(D.tpl, 'low_confidence', { answer });
      return t || `⚠️ নিশ্চিত না, তবে মনে হচ্ছে:\n\n${answer}`;
    }
    return answer;
  }

  function noMatch(q: string): string {
    const sugg = D.qa.slice(0, 3).map(i => (i.originalQuestions || ['?'])[0]).join(' • ');
    const name = RT.userName ? RT.userName + ', ' : '';
    const t = getTpl(D.tpl, 'no_match', { name, suggestions: sugg || 'হ্যালো • কেমন আছো' });
    return t || `${name}দুঃখিত, এই প্রশ্নের উত্তর এখনো জানি না 😔\n\n**চেষ্টা করো:**\n${sugg || 'হ্যালো • কেমন আছো'}\n\n📚 আমাকে শিখিয়ে দেবে? **(হ্যাঁ বলো)**`;
  }

  function updateContext(intentName: string | null, category: string | null) {
    if (!feat(D.cfg, 'contextEnabled')) return;
    if (intentName) RT.activeCtx = { name: intentName, lifespan: 5 };
    else if (category) RT.activeCtx = { name: category, lifespan: 3 };
    if (RT.activeCtx.lifespan > 0) RT.activeCtx.lifespan--;
  }

  function ctxBoost(candidates: SearchCandidate[]): SearchCandidate[] {
    if (!RT.activeCtx.name || RT.activeCtx.lifespan <= 0) return candidates;
    const rule = Object.values(D.ctx).find(r => r.trigger_context === RT.activeCtx.name);
    if (!rule) return candidates;
    return candidates.map(c => ({
      ...c, _score: c.item?.category === rule.boost_category ? c._score * 1.4 : c._score,
    }));
  }

  function updateMemory(q: string, a: string, entities: Record<string, string[]>, category: string) {
    if (category && !RT.memory.topics.includes(category)) RT.memory.topics.push(category);
    if (RT.memory.topics.length > 10) RT.memory.topics.shift();
    Object.entries(entities).forEach(([type, vals]) => {
      if (!RT.memory.entities[type]) RT.memory.entities[type] = [];
      RT.memory.entities[type] = [...new Set([...RT.memory.entities[type], ...vals])];
    });
    const nameMatch = q.match(/আমার নাম\s+(\S+)|আমি\s+(\S+)\s+বলছি/);
    if (nameMatch) RT.userName = nameMatch[1] || nameMatch[2];
  }

  async function getReply(inputText: string): Promise<ReplyResult> {
    if (!inputText.trim()) return { answer: 'কিছু লিখুন!', method: null, score: 0 };

    const spellResult = spellCorrect(inputText, D.spell, feat(D.cfg, 'spellCorrect'));
    const correctedText = spellResult.text;
    const contextualInput = getContextualInput(correctedText, RT.history, feat(D.cfg, 'contextEnabled'));
    const processed = synonymReplace(contextualInput, D.syn);
    const tokens = tokenize(processed);
    const expandedToks = expandQuery(tokens, D.syn, coMatrix, feat(D.cfg, 'queryExpansion'));
    const sentiment = detectSentiment(processed, D.sent, feat(D.cfg, 'sentimentEnabled'));
    const entities = extractEntities(processed, D.ent, feat(D.cfg, 'entityEnabled'));

    // Quick answers
    const mathResult = tryMath(correctedText, feat(D.cfg, 'mathEnabled'));
    if (mathResult) return { answer: mathResult, method: 'Math', score: 100, isMath: true };
    const timeResult = tryTimeDate(correctedText, feat(D.cfg, 'timeEnabled'));
    if (timeResult) return { answer: timeResult, method: 'DateTime', score: 100 };

    // Learning states
    if (RT.state === 'asking_teach') {
      const isYes = /^(হ্যাঁ|হ্যা|yes|ha|হা|ok|ঠিক|হ|ji|জি|হ্য|sure)$/i.test(correctedText.trim());
      if (isYes) {
        RT.state = 'awaiting_answer';
        const t = getTpl(D.tpl, 'teach_prompt', { question: RT.learningQ || '' });
        return { answer: t || `✏️ প্রশ্ন: **"${RT.learningQ}"**\n\nএবার উত্তর লিখো:`, method: null, score: 100 };
      } else {
        RT.state = 'normal'; RT.learningQ = null;
        return { answer: 'ঠিক আছে, পরে শেখানো যাবে! 😊 অন্য কিছু জিজ্ঞেস করো।', method: null, score: 100 };
      }
    }

    if (RT.state === 'awaiting_answer') {
      const ans = inputText.trim();
      if (RT.learningQ && ans.length > 3 && db) {
        try {
          const nr = push(ref(db, 'qaData'));
          await set(nr, {
            questions: [RT.learningQ], answer: ans, category: 'learned',
            tags: ['user-taught'], feedback: { positive: 0, negative: 0 },
            verified: false, timestamp: serverTimestamp(),
          });
          D.qa.push({
            originalQuestions: [RT.learningQ],
            processedQuestions: [synonymReplace(RT.learningQ, D.syn)],
            answer: ans, category: 'learned', firebaseKey: nr.key!,
            tags: ['user-taught'], feedback: { positive: 0, negative: 0 },
          });
          rebuildModels();
        } catch (e) { console.error(e); }
      }
      RT.state = 'normal'; RT.learningQ = null;
      const t = getTpl(D.tpl, 'teach_thanks');
      return { answer: t || '✅ শিখে নিলাম! ধন্যবাদ 😊 এখন এই প্রশ্নের উত্তর দিতে পারবো।', method: null, score: 100 };
    }

    // Intent
    const detInt = recognizeIntent(processed, D.int);
    if (detInt) {
      const resp = handleIntent(detInt);
      if (resp) {
        updateContext(detInt.name, null);
        RT.lastAnswer = resp; RT.lastUserQ = inputText;
        RT.history.push({ q: inputText, a: resp, category: 'intent', time: Date.now() });
        await logAnalytics(inputText, 'Intent', 100);
        return {
          answer: (SENT_PREFIXES[sentiment] || '') + applyPersonality(resp, RT.personality),
          method: 'Intent', score: 100, sentiment,
        };
      }
    }

    // Hybrid search
    let candidates = hybridSearch(processed, correctedText, tokens, expandedToks, bm25M, tfidfM, D);
    candidates = ctxBoost(candidates);
    const ranked = ensembleVote(candidates, entities, RT.memory, D.cfg);

    if (ranked.length) {
      const winner = ranked[0];
      const rawScore = Math.min(Math.round(winner.finalScore), 99);
      const methodStr = [...new Set(winner.methods)].slice(0, 3).join('+');
      let answer = wrapResponse(winner.item.answer, rawScore);
      answer = applyPersonality(answer, RT.personality);
      const prefix = SENT_PREFIXES[sentiment] || '';
      updateContext(null, winner.item.category);
      updateMemory(inputText, answer, entities, winner.item.category);
      RT.lastAnswer = winner.item.answer; RT.lastUserQ = inputText;
      RT.history.push({ q: inputText, a: winner.item.answer, category: winner.item.category, time: Date.now() });
      if (RT.history.length > 20) RT.history.shift();
      await logAnalytics(inputText, methodStr, rawScore);
      const related = feat(D.cfg, 'relatedQuestions') ? findRelated(winner.item, D.qa) : [];
      return {
        answer: prefix + answer, firebaseKey: winner.item.firebaseKey,
        method: methodStr, score: rawScore, sentiment,
        related: related.length ? related : null,
        spellCorrected: spellResult.corrected, originalText: spellResult.original,
      };
    }

    // No match
    if (feat(D.cfg, 'learningEnabled')) {
      RT.state = 'asking_teach'; RT.learningQ = inputText.toLowerCase().trim();
      if (db) {
        try { const ur = push(ref(db, 'unansweredLog')); await set(ur, { question: inputText, timestamp: serverTimestamp() }); } catch { /* skip */ }
      }
    }
    await logAnalytics(inputText, null, 0);
    return { answer: noMatch(inputText), method: null, score: 0, sentiment };
  }

  return { getReply, bm25M, tfidfM, coMatrix, rebuildModels };
}
