/**
 * Phase 3 — Synonym Engine
 *
 * Local hand-curated synonym DB (Bangla + English + Banglish) used to expand
 * a tokenized query into a richer set without diluting exact-match weight.
 *
 * Expanded tokens are tagged so the ranker can weight them lower than
 * the original tokens (see EXACT_WEIGHT vs SYN_WEIGHT in rankingPipeline).
 */

/** canonical → list of equivalent terms */
export const LOCAL_SYNONYMS: Record<string, string[]> = {
  // Commerce
  buy:        ['purchase', 'order', 'কিনতে', 'কিনব', 'কিনবো', 'কেনা', 'order'],
  sell:       ['বিক্রি', 'বেচা', 'sale'],
  price:      ['cost', 'rate', 'দাম', 'মূল্য', 'খরচ'],
  cheap:      ['affordable', 'low-cost', 'সস্তা', 'কম দামে', 'কমদামি'],
  // Tech / devices
  phone:      ['smartphone', 'mobile', 'cellphone', 'ফোন', 'মোবাইল', 'সেলফোন'],
  laptop:     ['notebook', 'computer', 'ল্যাপটপ', 'কম্পিউটার'],
  car:        ['automobile', 'vehicle', 'গাড়ি', 'গাড়ী', 'অটোমোবাইল'],
  // Quality
  fast:       ['quick', 'rapid', 'দ্রুত', 'তাড়াতাড়ি', 'জলদি'],
  slow:       ['ধীর', 'আস্তে', 'sluggish'],
  good:       ['great', 'nice', 'fine', 'ভালো', 'ভাল', 'উত্তম', 'চমৎকার', 'bhalo'],
  bad:        ['poor', 'খারাপ', 'বাজে', 'kharap'],
  big:        ['large', 'huge', 'বড়', 'বিশাল'],
  small:      ['tiny', 'little', 'ছোট', 'ক্ষুদ্র'],
  // Actions
  make:       ['create', 'build', 'বানানো', 'তৈরি', 'বানাবো'],
  learn:      ['study', 'শিখতে', 'শেখা', 'পড়া'],
  help:       ['assist', 'support', 'সাহায্য', 'হেল্প'],
  // People / family (non-sensitive)
  friend:     ['বন্ধু', 'mate'],
  teacher:    ['instructor', 'শিক্ষক', 'স্যার', 'ম্যাডাম'],
  // Places
  home:       ['house', 'বাড়ি', 'ঘর'],
  school:     ['স্কুল', 'বিদ্যালয়'],
  // Time
  today:      ['আজ', 'now'],
  tomorrow:   ['আগামীকাল', 'কাল'],
  yesterday:  ['গতকাল'],
};

/** Reverse index: any-term → canonical */
const REVERSE: Record<string, string> = {};
for (const [canon, list] of Object.entries(LOCAL_SYNONYMS)) {
  REVERSE[canon] = canon;
  for (const w of list) REVERSE[w.toLowerCase()] = canon;
}

export interface ExpandedQuery {
  exact: string[];     // original normalized tokens (highest weight)
  expanded: string[];  // synonyms added (lower weight)
  all: string[];       // union, de-duplicated
}

export function expandWithSynonyms(
  tokens: string[],
  userSyn: Record<string, string[]> = {},
): ExpandedQuery {
  const exact = [...new Set(tokens)];
  const extra = new Set<string>();

  // Merge user-supplied synonyms with local DB
  const merged: Record<string, string[]> = { ...LOCAL_SYNONYMS };
  for (const [k, v] of Object.entries(userSyn || {})) {
    if (Array.isArray(v)) merged[k] = [...(merged[k] || []), ...v];
  }

  for (const tok of exact) {
    const canon = REVERSE[tok] || tok;
    const syns = merged[canon];
    if (syns) for (const s of syns) {
      const ls = s.toLowerCase();
      if (!exact.includes(ls)) extra.add(ls);
    }
    if (canon !== tok && !exact.includes(canon)) extra.add(canon);
  }

  const expanded = [...extra];
  return { exact, expanded, all: [...new Set([...exact, ...expanded])] };
}
