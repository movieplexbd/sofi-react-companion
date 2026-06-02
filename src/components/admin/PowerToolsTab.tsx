import { useState } from 'react';
import { Replace, Tag, Trash2, GitMerge, Sparkles, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './Stat';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

/**
 * PowerToolsTab — destructive/bulk operations on the dataset:
 * - Find & Replace across all answers/questions
 * - Bulk reassign category by filter
 * - Bulk delete by filter
 * - Merge duplicate answers
 * - Auto-generate Banglish variants (heuristic, no AI)
 */
export default function PowerToolsTab({ admin }: { admin: Admin }) {
  // Find & Replace
  const [find, setFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [inAnswers, setInAnswers] = useState(true);
  const [inQuestions, setInQuestions] = useState(false);
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Bulk by filter
  const [filterText, setFilterText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');

  const qa = admin.all.qaData || {};

  function matchesFilter(v: any): boolean {
    if (!filterText.trim()) return false;
    const n = filterText.toLowerCase();
    const qs = (v.questions || [v.question || '']).join(' ').toLowerCase();
    return qs.includes(n) || String(v.answer || '').toLowerCase().includes(n) || String(v.category || '').toLowerCase() === n;
  }
  const matchedKeys = Object.entries<any>(qa).filter(([, v]) => matchesFilter(v)).map(([k]) => k);

  async function doFindReplace() {
    if (!find) { toast.error('Find string required'); return; }
    if (!confirm(`Replace "${find}" → "${replaceWith}" across all entries?`)) return;
    try {
      const n = await admin.findReplace(find, replaceWith, { inAnswers, inQuestions, caseSensitive, regex });
      toast.success(`Updated ${n} entries`);
      await admin.reload();
    } catch (e: any) { toast.error(e?.message); }
  }

  async function doBulkCategory() {
    if (!matchedKeys.length || !bulkCategory.trim()) { toast.error('Need filter + category'); return; }
    if (!confirm(`Set category "${bulkCategory}" on ${matchedKeys.length} entries?`)) return;
    try {
      await admin.bulkUpdateCategory(matchedKeys, bulkCategory.trim());
      toast.success(`Updated ${matchedKeys.length}`);
      await admin.reload();
    } catch (e: any) { toast.error(e?.message); }
  }

  async function doBulkDelete() {
    if (!matchedKeys.length) { toast.error('Filter matches nothing'); return; }
    if (!confirm(`Delete ${matchedKeys.length} entries? This cannot be undone.`)) return;
    try {
      const ok = await admin.bulkDeleteQA(matchedKeys);
      toast.success(`Deleted ${ok}`);
      await admin.reload();
    } catch (e: any) { toast.error(e?.message); }
  }

  async function mergeDuplicateAnswers() {
    const byA = new Map<string, string[]>();
    for (const [k, v] of Object.entries<any>(qa)) {
      const key = String(v.answer || '').trim().toLowerCase();
      if (!key) continue;
      const arr = byA.get(key) || []; arr.push(k); byA.set(key, arr);
    }
    const groups = Array.from(byA.values()).filter(arr => arr.length > 1);
    if (!groups.length) { toast.info('No duplicate answers found'); return; }
    if (!confirm(`Merge ${groups.length} duplicate-answer groups (${groups.reduce((s, g) => s + g.length - 1, 0)} extra entries will be removed)?`)) return;
    let merged = 0;
    for (const grp of groups) {
      const [keep, ...rest] = grp;
      const allQs: string[] = [];
      for (const k of grp) {
        const v = qa[k];
        const qs = Array.isArray(v.questions) ? v.questions : [v.question || ''];
        allQs.push(...qs);
      }
      const dedupQs = Array.from(new Set(allQs.map(q => q.trim()).filter(Boolean)));
      await admin.updateQA(keep, { questions: dedupQs });
      await admin.bulkDeleteQA(rest);
      merged += rest.length;
    }
    toast.success(`Merged ${merged} duplicate entries`);
    await admin.reload();
  }

  /** Heuristic Banglish variants: simple swaps that double recall without AI. */
  function banglishVariants(q: string): string[] {
    const out = new Set<string>();
    const swaps: Array<[RegExp, string]> = [
      [/ki vabe/gi, 'kivabe'], [/kivabe/gi, 'ki vabe'],
      [/keno/gi, 'kano'], [/kano/gi, 'keno'],
      [/tumi/gi, 'tumii'], [/ami/gi, 'amii'],
      [/kemon/gi, 'kemoon'], [/valo/gi, 'bhalo'], [/bhalo/gi, 'valo'],
      [/koto/gi, 'kotto'], [/kothay/gi, 'kothai'],
    ];
    for (const [re, to] of swaps) if (re.test(q)) out.add(q.replace(re, to));
    return Array.from(out);
  }

  async function generateVariants() {
    const entries = Object.entries<any>(qa);
    if (!entries.length) return;
    if (!confirm(`Scan ${entries.length} entries and add Banglish phrasing variants where applicable?`)) return;
    let added = 0;
    for (const [k, v] of entries) {
      const qs: string[] = Array.isArray(v.questions) ? v.questions : [v.question || ''];
      const extras = new Set<string>();
      for (const q of qs) for (const v of banglishVariants(q)) if (!qs.includes(v)) extras.add(v);
      if (extras.size) {
        await admin.updateQA(k, { questions: [...qs, ...extras] });
        added += extras.size;
      }
    }
    toast.success(`Added ${added} new variants`);
    await admin.reload();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Section title="Find & Replace" desc="Bulk text replacement across the dataset. Supports regex.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={find} onChange={e => setFind(e.target.value)} placeholder="Find…" className="px-3 py-2 rounded-md bg-background border border-border text-sm font-mono" />
          <input value={replaceWith} onChange={e => setReplaceWith(e.target.value)} placeholder="Replace with…" className="px-3 py-2 rounded-md bg-background border border-border text-sm font-mono" />
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={inAnswers} onChange={e => setInAnswers(e.target.checked)} /> Answers</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={inQuestions} onChange={e => setInQuestions(e.target.checked)} /> Questions</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> Case-sensitive</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={regex} onChange={e => setRegex(e.target.checked)} /> Regex</label>
        </div>
        <button onClick={doFindReplace} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
          <Replace className="w-4 h-4" /> Run replacement
        </button>
      </Section>

      <Section title="Bulk filter actions" desc={`Filter matches: ${matchedKeys.length} entries`}>
        <input
          value={filterText} onChange={e => setFilterText(e.target.value)}
          placeholder="Search text (question, answer, or exact category)…"
          className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
        />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <input
            value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
            placeholder="New category for matched…"
            className="px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <button onClick={doBulkCategory} className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm flex items-center gap-1.5">
            <Tag className="w-4 h-4" /> Recategorize
          </button>
        </div>
        <button onClick={doBulkDelete} className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-sm flex items-center gap-1.5">
          <Trash2 className="w-4 h-4" /> Delete matched ({matchedKeys.length})
        </button>
      </Section>

      <Section title="Dataset hygiene" desc="One-shot cleanup operations.">
        <div className="flex flex-wrap gap-2">
          <button onClick={mergeDuplicateAnswers} className="px-3 py-2 rounded-md bg-muted text-sm flex items-center gap-1.5">
            <GitMerge className="w-4 h-4" /> Merge duplicate answers
          </button>
          <button onClick={generateVariants} className="px-3 py-2 rounded-md bg-muted text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Auto-generate Banglish variants
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">No external AI — pure heuristic transforms (kivabe ↔ ki vabe, valo ↔ bhalo, etc.).</p>
      </Section>

      <Section title="Live query tester" desc="Type a query as a user would. Shows the top-3 matches your current dataset would return.">
        <QueryTester admin={admin} />
      </Section>
    </div>
  );
}

function QueryTester({ admin }: { admin: Admin }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ key: string; q: string; a: string; score: number }[]>([]);

  function score(query: string, target: string): number {
    const a = query.toLowerCase(), b = target.toLowerCase();
    if (!a || !b) return 0;
    if (b.includes(a)) return 1;
    const toks = new Set(a.split(/\s+/));
    const bt = new Set(b.split(/\s+/));
    let n = 0; toks.forEach(t => bt.has(t) && n++);
    return n / Math.max(toks.size, 1);
  }

  function run() {
    const qa = admin.all.qaData || {};
    const scored = Object.entries<any>(qa).map(([key, v]) => {
      const qs: string[] = Array.isArray(v.questions) ? v.questions : [v.question || ''];
      const best = Math.max(...qs.map(x => score(q, x)));
      return { key, q: qs[0], a: v.answer, score: best };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    setResults(scored);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="Tumi ke?"
          className="px-3 py-2 rounded-md bg-background border border-border text-sm" />
        <button onClick={run} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
          <Play className="w-4 h-4" /> Test
        </button>
      </div>
      <div className="divide-y divide-border border border-border rounded-md">
        {results.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No results yet.</div>}
        {results.map(r => (
          <div key={r.key} className="p-2 text-xs">
            <div className="flex justify-between gap-2">
              <div className="font-medium truncate">{r.q}</div>
              <span className="font-mono text-[10px] text-primary">{(r.score * 100).toFixed(0)}%</span>
            </div>
            <div className="text-muted-foreground line-clamp-2 mt-0.5">{r.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
