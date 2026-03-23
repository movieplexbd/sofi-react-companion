/** Tokenize Bengali/English text into words */
export function tokenize(text: string): string[] {
  if (!text?.trim()) return [];
  return text.toLowerCase().trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?।॥"—:'"''""\[\]]/g, '')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(w => w.length > 1);
}

/** Replace synonyms with canonical forms */
export function synonymReplace(text: string, synMap: Record<string, string[]>): string {
  if (!text || !synMap) return text.toLowerCase().trim();
  let t = text.toLowerCase().trim();
  for (const [canon, syns] of Object.entries(synMap)) {
    if (!Array.isArray(syns)) continue;
    syns.forEach(s => {
      try {
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(?:^|\\s|[।,])' + escaped + '(?:$|\\s|[।,])', 'gi');
        if (re.test(t)) t = t.replace(new RegExp(escaped, 'gi'), canon);
      } catch { /* skip */ }
    });
  }
  return t;
}

const BUILT_IN_SPELL: Record<string, string> = {
  'কেমোন': 'কেমন', 'কেমুন': 'কেমন', 'আচো': 'আছো', 'আচেন': 'আছেন',
  'সমস্যো': 'সমস্যা', 'হেলথ': 'স্বাস্থ্য',
  'জানাতে': 'জানাতে', 'কিবাবে': 'কিভাবে',
  'bolte': 'বলতে', 'jante': 'জানতে', 'kemon': 'কেমন',
  'ki': 'কি', 'ke': 'কে', 'keno': 'কেন', 'kobe': 'কবে',
  'kivabe': 'কিভাবে', 'bolun': 'বলুন', 'bolen': 'বলেন',
  'achen': 'আছেন', 'acho': 'আছো', 'ami': 'আমি',
  'tumi': 'তুমি', 'apni': 'আপনি', 'kothay': 'কোথায়',
  'kokhon': 'কখন', 'holo': 'হলো', 'hobe': 'হবে',
};

export function spellCorrect(
  text: string,
  spellMap: Record<string, string>,
  enabled: boolean
): { text: string; corrected: boolean; original: string } {
  if (!enabled) return { text, corrected: false, original: text };
  const allSpell = { ...BUILT_IN_SPELL, ...(spellMap || {}) };
  let t = text;
  let changed = false;
  Object.entries(allSpell).forEach(([w, r]) => {
    try {
      const re = new RegExp('(?:^|\\s)' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\s)', 'gi');
      if (re.test(t)) { t = t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), r); changed = true; }
    } catch { /* skip */ }
  });
  return { text: t, corrected: changed, original: text };
}

/** Bengali phonetic normalization — enhanced */
export function phonetic(text: string): string {
  return text
    .replace(/ক্ষ/g, 'kkh').replace(/জ্ঞ/g, 'gn').replace(/ঞ্চ/g, 'nc')
    .replace(/ঞ্জ/g, 'nj').replace(/ং/g, 'ng').replace(/ঃ/g, 'h')
    .replace(/[আা]/g, 'a').replace(/[ইিঈী]/g, 'i').replace(/[উুঊূ]/g, 'u')
    .replace(/[এে]/g, 'e').replace(/[ওো]/g, 'o').replace(/[ঐৈ]/g, 'oi').replace(/[ঔৌ]/g, 'ou')
    .replace(/[ক]/g, 'k').replace(/[খ]/g, 'kh').replace(/[গ]/g, 'g').replace(/[ঘ]/g, 'gh')
    .replace(/[চ]/g, 'c').replace(/[ছ]/g, 'ch').replace(/[জ]/g, 'j').replace(/[ঝ]/g, 'jh')
    .replace(/[ট]/g, 't').replace(/[ঠ]/g, 'th').replace(/[ড]/g, 'd').replace(/[ঢ]/g, 'dh')
    .replace(/[ত]/g, 't').replace(/[থ]/g, 'th').replace(/[দ]/g, 'd').replace(/[ধ]/g, 'dh')
    .replace(/[ননণ]/g, 'n').replace(/[প]/g, 'p').replace(/[ফ]/g, 'f')
    .replace(/[ব]/g, 'b').replace(/[ভ]/g, 'bh').replace(/[ম]/g, 'm')
    .replace(/[যজ]/g, 'j').replace(/[র]/g, 'r').replace(/[ল]/g, 'l')
    .replace(/[শষস]/g, 's').replace(/[হ]/g, 'h')
    .replace(/[্ঁ়]/g, '');
}

/** Levenshtein distance */
export function lev(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

/** Substring containment score — boosts when query is contained in or contains the target */
export function substringScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (t.includes(q)) return 0.85 + (q.length / t.length) * 0.15;
  if (q.includes(t)) return 0.6 + (t.length / q.length) * 0.2;
  // Check word-level containment
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  const matchCount = qWords.filter(w => tWords.some(tw => tw.includes(w) || w.includes(tw))).length;
  return matchCount > 0 ? (matchCount / Math.max(qWords.length, 1)) * 0.5 : 0;
}
