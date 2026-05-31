/**
 * Phase 2 — Advanced Normalization
 *
 * Pipeline:
 *  1. Unicode/whitespace normalize
 *  2. Banglish collapse + spelling map (`ki vabe` → `kivabe`, `valo` → `bhalo`)
 *  3. Lowercase
 *  4. Tokenize
 *  5. Stopword removal (bn + en)
 *  6. Light stemming + lemmatization (suffix stripping for both languages)
 *  7. Duplicate token removal (preserving order)
 *
 * No external libraries / models. Pure deterministic functions.
 */

/* ── Banglish multi-word collapse (run BEFORE tokenization) ── */
const BANGLISH_PHRASES: Array<[RegExp, string]> = [
  [/\bki\s+vabe\b/gi, 'kivabe'],
  [/\bki\s+bhabe\b/gi, 'kivabe'],
  [/\bkemon\s+acho\b/gi, 'kemonacho'],
  [/\bkemon\s+achen\b/gi, 'kemonachen'],
  [/\bki\s+korbo\b/gi, 'kikorbo'],
  [/\bki\s+vabe\b/gi, 'kivabe'],
];

/* ── Banglish single-word canonical spellings ── */
const BANGLISH_WORDS: Record<string, string> = {
  valo: 'bhalo', valobasha: 'bhalobasha', kheyechi: 'kheyechi',
  korbo: 'korbo', korte: 'korte', korechi: 'korechi',
  kivabe: 'kivabe', kibhabe: 'kivabe', kibabe: 'kivabe',
  bolun: 'bolun', bolen: 'bolen', bolte: 'bolte',
  ami: 'ami', tumi: 'tumi', apni: 'apni', se: 'se',
  ki: 'ki', ke: 'ke', keno: 'keno', kobe: 'kobe', kothay: 'kothay',
  phn: 'phone', mob: 'mobile', moter: 'motor',
};

/* ── Stopwords (kept conservative — we don't want to nuke meaning) ── */
const STOPWORDS_EN = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'of','in','on','at','to','for','with','by','from','as',
  'and','or','but','if','then','so','than','that','this','these','those',
  'i','you','he','she','it','we','they','me','my','your',
  'do','does','did','have','has','had','will','would','can','could','should',
]);

const STOPWORDS_BN = new Set([
  'এবং','অথবা','কিন্তু','তবে','যদি','তাহলে','কারণ','যেহেতু',
  'হয়','হবে','হলো','ছিল','ছিলো','আছে','থাকবে',
  'একটা','একটি','একই','কোনো','কোনও',
  'আমি','তুমি','সে','আমরা','তোমরা','তারা','আপনি','উনি',
  'এই','ওই','সেই','যে','যা',
  'থেকে','দিয়ে','সাথে','পর','আগে','মধ্যে','উপর','নিচে',
  'ও','র','এর','এ','য়',
]);

/* ── English suffix-strip lemmatization (very light Porter-lite) ── */
const EN_SUFFIXES = [
  'ingly','edly','iest','ier','ing','est','ied','ies','ed','ly','es','s',
];
function lemmatizeEn(w: string): string {
  if (w.length <= 3) return w;
  for (const s of EN_SUFFIXES) {
    if (w.length > s.length + 2 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

/* ── Bangla suffix-strip stemmer (covers common case/verb endings) ── */
const BN_SUFFIXES = [
  'গুলোকে','গুলোর','গুলোয়','গুলো','গুলি','দেরকে','দেরই','দেরও','দের',
  'টিকে','টির','টিও','টির','টিতে','টা','টি',
  'কেও','কেই','কে','রও','রই','রকে','রা','র','য়',
  'ছিলাম','ছিলে','ছিল','ছিলো','চ্ছি','চ্ছে','চ্ছ',
  'ব','বে','বো','বেন','েছি','েছ','েছে','েছেন',
  'ছ','ছে','ছেন','ছ',
  'তে','তেই','তেও','তো',
  'টায়','টির',
];
function stemBn(w: string): string {
  if (w.length <= 2) return w;
  for (const s of BN_SUFFIXES) {
    if (w.length > s.length + 1 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

/* ── Per-token normalization ── */
function isBangla(w: string) { return /[\u0980-\u09FF]/.test(w); }
function isLatin(w: string) { return /^[a-z0-9]+$/i.test(w); }

function normalizeToken(raw: string): string {
  let w = raw.toLowerCase();
  if (isLatin(w)) {
    if (BANGLISH_WORDS[w]) w = BANGLISH_WORDS[w];
    w = lemmatizeEn(w);
  } else if (isBangla(w)) {
    w = stemBn(w);
  }
  return w;
}

/** Main normalize entry — returns both raw text and processed tokens */
export interface NormalizeResult {
  raw: string;
  cleaned: string;       // collapsed banglish, lowercased, punctuation stripped
  tokens: string[];      // post stopword + stem + dedupe (preserves order)
  rawTokens: string[];   // before stopword removal (for engines needing full info)
}

const PUNCT_RE = /[.,\/#!$%\^&\*;:{}=\-_`~()?।॥"—:'"''""\[\]]/g;

export function normalize(text: string): NormalizeResult {
  if (!text?.trim()) return { raw: '', cleaned: '', tokens: [], rawTokens: [] };

  let s = text.toLowerCase().trim();

  // Phase 2a: banglish phrase collapse
  for (const [re, repl] of BANGLISH_PHRASES) s = s.replace(re, repl);

  // Phase 2b: strip punctuation, normalize whitespace
  const cleaned = s.replace(PUNCT_RE, ' ').replace(/\s+/g, ' ').trim();

  // Phase 2c: tokenize
  const rawTokens = cleaned.split(' ').filter(w => w.length > 0);

  // Phase 2d: stopword removal, normalization, dedupe
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (STOPWORDS_EN.has(t) || STOPWORDS_BN.has(t)) continue;
    const n = normalizeToken(t);
    if (n.length < 2) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    tokens.push(n);
  }

  return { raw: text, cleaned, tokens, rawTokens };
}
