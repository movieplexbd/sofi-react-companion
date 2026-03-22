/** Tokenize Bengali/English text into words */
export function tokenize(text: string): string[] {
  if (!text?.trim()) return [];
  return text.toLowerCase().trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?।॥"—:]/g, '')
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
        const re = new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        t = t.replace(re, canon);
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
      const re = new RegExp('\\b' + w + '\\b', 'gi');
      if (re.test(t)) { t = t.replace(re, r); changed = true; }
    } catch { /* skip */ }
  });
  return { text: t, corrected: changed, original: text };
}

/** Bengali phonetic normalization */
export function phonetic(text: string): string {
  return text
    .replace(/[আা]/g, 'a').replace(/[ইিঈী]/g, 'i').replace(/[উুঊূ]/g, 'u')
    .replace(/[এে]/g, 'e').replace(/[ওো]/g, 'o').replace(/[ক]/g, 'k')
    .replace(/[গ]/g, 'g').replace(/[চছ]/g, 'c').replace(/[টত]/g, 't')
    .replace(/[ডদ]/g, 'd').replace(/[ননণ]/g, 'n').replace(/[প]/g, 'p')
    .replace(/[ব]/g, 'b').replace(/[ম]/g, 'm').replace(/[র]/g, 'r')
    .replace(/[ল]/g, 'l').replace(/[শষস]/g, 's').replace(/[হ]/g, 'h')
    .replace(/[যজ]/g, 'j').replace(/ং/g, 'ng').replace(/ক্ষ/g, 'kkh')
    .replace(/[ফ]/g, 'f').replace(/[ঘ]/g, 'gh').replace(/[ঝ]/g, 'jh');
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
