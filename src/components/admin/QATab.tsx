import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, CheckSquare, Square, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from './Stat';
import type { useAdmin, QARecord } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;
interface Row extends QARecord { key: string; }

const EMPTY: QARecord = { questions: [''], answer: '', category: 'general', tags: [] };
type SortMode = 'recent' | 'alpha' | 'feedback' | 'category';

export default function QATab({ admin }: { admin: Admin }) {
  const [q, setQ] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<QARecord>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [categoryFilter, setCategoryFilter] = useState('');

  const rows: Row[] = useMemo(() => {
    return Object.entries(admin.all.qaData || {}).map(([key, v]: any) => ({
      key,
      questions: Array.isArray(v.questions) ? v.questions : [v.question || ''],
      answer: v.answer || '',
      category: v.category || 'general',
      tags: v.tags || [],
      feedback: v.feedback || { positive: 0, negative: 0 },
    }));
  }, [admin.all.qaData]);

  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.category || 'general'))).sort(), [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter(r =>
        r.questions.some(qq => qq.toLowerCase().includes(needle)) ||
        r.answer.toLowerCase().includes(needle) ||
        r.category?.toLowerCase().includes(needle)
      );
    }
    if (categoryFilter) out = out.filter(r => r.category === categoryFilter);
    const sorted = [...out];
    if (sortMode === 'alpha') sorted.sort((a, b) => a.questions[0].localeCompare(b.questions[0]));
    else if (sortMode === 'feedback') sorted.sort((a, b) => (b.feedback!.negative - b.feedback!.positive) - (a.feedback!.negative - a.feedback!.positive));
    else if (sortMode === 'category') sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else sorted.reverse();
    return sorted;
  }, [rows, q, sortMode, categoryFilter]);

  function startNew() { setDraft(EMPTY); setEditingKey(null); setShowForm(true); }
  function startEdit(r: Row) {
    setDraft({ questions: r.questions, answer: r.answer, category: r.category, tags: r.tags });
    setEditingKey(r.key); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditingKey(null); setDraft(EMPTY); }

  async function save() {
    const qs = draft.questions.map(s => s.trim()).filter(Boolean);
    if (!qs.length || !draft.answer.trim()) { toast.error('Question and answer required'); return; }
    try {
      if (editingKey) { await admin.updateQA(editingKey, { ...draft, questions: qs }); toast.success('Updated'); }
      else { await admin.addQA({ ...draft, questions: qs }); toast.success('Added'); }
      await admin.reload(); cancel();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
  }

  async function del(key: string) {
    if (!confirm('Delete this QA?')) return;
    try { await admin.deleteQA(key); await admin.reload(); toast.success('Deleted'); }
    catch (e: any) { toast.error(e?.message || 'Delete failed'); }
  }

  function toggle(key: string) {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function selectAllShown() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.key)));
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} entries?`)) return;
    const ok = await admin.bulkDeleteQA(Array.from(selected));
    toast.success(`Deleted ${ok}`);
    setSelected(new Set()); await admin.reload();
  }

  async function bulkSetCategory() {
    if (!selected.size) return;
    const cat = prompt('New category for selected:'); if (!cat) return;
    await admin.bulkUpdateCategory(Array.from(selected), cat.trim());
    toast.success('Recategorized'); setSelected(new Set()); await admin.reload();
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <Section
        title={`QA Pairs (${rows.length})`}
        desc="Search, sort, edit, or apply bulk actions."
        action={
          <button onClick={startNew} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> Add
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
              className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-2 py-2 rounded-md bg-background border border-border text-sm">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
            className="px-2 py-2 rounded-md bg-background border border-border text-sm">
            <option value="recent">Recent</option>
            <option value="alpha">A→Z</option>
            <option value="feedback">Worst-rated</option>
            <option value="category">Category</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-primary/5 border border-primary/20 rounded p-2 text-xs">
            <span className="font-semibold">{selected.size} selected</span>
            <button onClick={bulkSetCategory} className="px-2 py-1 rounded bg-secondary text-secondary-foreground">Set category</button>
            <button onClick={bulkDelete} className="px-2 py-1 rounded bg-destructive text-destructive-foreground">Delete</button>
            <button onClick={() => setSelected(new Set())} className="px-2 py-1 rounded bg-muted ml-auto">Clear</button>
          </div>
        )}

        <button onClick={selectAllShown} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
          {selected.size === filtered.length && filtered.length > 0
            ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          Select all shown ({filtered.length})
        </button>

        <div className="divide-y divide-border max-h-[55vh] overflow-y-auto -mx-4 md:-mx-5">
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No entries.</div>}
          {filtered.map(r => {
            const sel = selected.has(r.key);
            return (
              <div key={r.key} className={`px-4 md:px-5 py-3 hover:bg-muted/40 ${sel ? 'bg-primary/5' : ''}`}>
                <div className="flex justify-between gap-3">
                  <button onClick={() => toggle(r.key)} className="flex-shrink-0 mt-0.5">
                    {sel ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.questions[0]}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.answer}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.category}</span>
                      {r.questions.length > 1 && <span className="text-muted-foreground">+{r.questions.length - 1} variants</span>}
                      <span className="text-emerald-500">👍 {r.feedback?.positive || 0}</span>
                      <span className="text-rose-500">👎 {r.feedback?.negative || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(r.key)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-semibold">{editingKey ? 'Edit QA' : 'Add new QA'}</h3>
              <button onClick={cancel} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5">Questions (one per line)</label>
                <textarea value={draft.questions.join('\n')}
                  onChange={e => setDraft({ ...draft, questions: e.target.value.split('\n') })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono"
                  placeholder="Tumi ke?&#10;তুমি কে?&#10;Who are you?" />
                <p className="text-[10px] text-muted-foreground mt-1">Add multiple variants to improve matching.</p>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Answer (Markdown supported)</label>
                <textarea value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5">Category</label>
                  <input value={draft.category || ''} onChange={e => setDraft({ ...draft, category: e.target.value })}
                    list="cat-list"
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm" />
                  <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5">Tags (comma)</label>
                  <input value={(draft.tags || []).join(', ')}
                    onChange={e => setDraft({ ...draft, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button onClick={cancel} className="px-3 py-1.5 rounded-md bg-muted text-sm">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
