import { useRef, useState, useMemo } from 'react';
import { Upload, FileCheck2, AlertCircle, FileDown, Wand2, Globe, GitMerge, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import { parseDataset, dedupAgainst, type ParseResult } from '../../lib/parseDataset';
import type { useAdmin, QARecord } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

const SAMPLE_JSON = `[
  {
    "questions": ["Tumi ke?", "তুমি কে?", "Who are you?"],
    "answer": "আমি Sofia, তোমার AI সঙ্গী।",
    "category": "intro",
    "tags": ["greeting"]
  }
]`;
const SAMPLE_CSV = `question,answer,category,tags
"Tumi ke?","আমি Sofia।","intro","greeting"`;
const SAMPLE_CONV = `{"messages":[{"role":"user","content":"Tumi ke?"},{"role":"assistant","content":"আমি Sofia।"}]}`;

export default function BulkTab({ admin }: { admin: Admin }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [rawText, setRawText] = useState('');
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [skipDupes, setSkipDupes] = useState(true);
  const [autoMerge, setAutoMerge] = useState(true);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const dedup = useMemo(
    () => preview ? dedupAgainst(preview.items, admin.all.qaData) : null,
    [preview, admin.all.qaData]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    let all: ParseResult = { items: [], skipped: 0, format: '', warnings: [] };
    const formats: string[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      const p = parseDataset(text, f.name);
      all.items.push(...p.items);
      all.skipped += p.skipped;
      formats.push(`${f.name}:${p.format}`);
      if (p.warnings?.length) all.warnings!.push(...p.warnings.map(w => `${f.name}: ${w}`));
    }
    all.format = formats.join(', ');
    setPreview(all); setRawText('');
    toast.success(`Parsed ${all.items.length} items from ${files.length} file(s)`);
  }

  function parseTextarea() {
    if (!rawText.trim()) { toast.error('Paste content first'); return; }
    const p = parseDataset(rawText);
    setPreview(p);
    toast.success(`Parsed ${p.items.length} items (${p.format})`);
  }

  async function importFromUrl() {
    if (!url.trim()) { toast.error('URL required'); return; }
    try {
      toast.loading('Fetching…', { id: 'fetch' });
      const res = await fetch(url, { mode: 'cors' });
      const text = await res.text();
      const p = parseDataset(text, url.split('/').pop() || '');
      setPreview(p);
      toast.success(`Fetched ${p.items.length} items`, { id: 'fetch' });
    } catch (e: any) { toast.error(e?.message || 'Fetch failed', { id: 'fetch' }); }
  }

  function applyDefaultCategory(items: QARecord[]) {
    if (!defaultCategory.trim()) return items;
    return items.map(it => ({ ...it, category: it.category && it.category !== 'general' ? it.category : defaultCategory.trim() }));
  }

  async function commit() {
    if (!preview?.items.length || !dedup) return;
    const fresh = applyDefaultCategory(dedup.fresh);
    const mergeOps = autoMerge ? dedup.mergeable : [];
    const skipped = skipDupes ? dedup.duplicates.length : 0;
    const toAdd = skipDupes ? fresh : applyDefaultCategory(preview.items);
    const total = toAdd.length + mergeOps.length;
    if (!total) { toast.info('Nothing new to upload'); return; }

    setUploading(true);
    setProgress({ done: 0, total });
    let done = 0;
    try {
      for (const m of mergeOps) {
        await admin.mergeIntoQA(m.existingKey, m.newVariants);
        done++; setProgress({ done, total });
      }
      const ok = await admin.bulkAddQA(toAdd, (n) => { setProgress({ done: done + n, total }); });
      toast.success(`Added ${ok} · Merged ${mergeOps.length} · Skipped ${skipped}`);
      await admin.reload();
      setPreview(null); setRawText('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setUploading(false); }
  }

  function removeItem(i: number) {
    if (!preview) return;
    const next = { ...preview, items: preview.items.filter((_, idx) => idx !== i) };
    setPreview(next);
  }

  function updateItem(i: number, patch: Partial<QARecord>) {
    if (!preview) return;
    const next = { ...preview, items: preview.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) };
    setPreview(next);
  }

  async function exportJSON() {
    const blob = new Blob([JSON.stringify(admin.all.qaData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sofia-qa-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported');
  }

  async function exportCSV() {
    const rows = [['question', 'answer', 'category', 'tags']];
    for (const v of Object.values<any>(admin.all.qaData || {})) {
      const q = (v.questions?.[0] || v.question || '').replace(/"/g, '""');
      const a = String(v.answer || '').replace(/"/g, '""');
      rows.push([`"${q}"`, `"${a}"`, `"${v.category || ''}"`, `"${(v.tags || []).join(';')}"`]);
    }
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `sofia-qa-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Section
        title="Bulk Upload"
        desc="Drop JSON / JSONL / CSV / TSV / YAML / TXT / chat-log. Multiple files supported. Auto-detects format, deduplicates, smart-merges."
        action={
          <div className="flex gap-1">
            <button onClick={exportJSON} className="px-3 py-1.5 rounded-md bg-muted text-sm flex items-center gap-1.5">
              <FileDown className="w-4 h-4" /> JSON
            </button>
            <button onClick={exportCSV} className="px-3 py-1.5 rounded-md bg-muted text-sm flex items-center gap-1.5">
              <FileDown className="w-4 h-4" /> CSV
            </button>
          </div>
        }
      >
        <label
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition"
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-medium">Drop files here or click to browse</div>
          <div className="text-xs text-muted-foreground mt-1">.json · .jsonl · .csv · .tsv · .yaml · .txt — multi-select OK</div>
          <input
            ref={fileRef} type="file" multiple
            accept=".json,.jsonl,.csv,.tsv,.yaml,.yml,.txt"
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <input
            value={url} onChange={e => setUrl(e.target.value)}
            placeholder="Or paste URL to JSON / CSV…"
            className="px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <button onClick={importFromUrl} className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm flex items-center gap-1.5">
            <Globe className="w-4 h-4" /> Import URL
          </button>
        </div>

        <div className="text-center text-xs text-muted-foreground">— or paste raw text —</div>

        <textarea
          value={rawText} onChange={e => setRawText(e.target.value)}
          rows={5}
          placeholder={`JSON / CSV / YAML / Q:A / chat-log\n\nQ: Tumi ke?\nA: আমি Sofia।`}
          className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono"
        />
        <button onClick={parseTextarea} className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm flex items-center gap-1.5">
          <Wand2 className="w-4 h-4" /> Parse text
        </button>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show format examples</summary>
          <pre className="mt-2 p-3 bg-muted rounded text-[11px] overflow-x-auto">{SAMPLE_JSON}</pre>
          <pre className="mt-2 p-3 bg-muted rounded text-[11px] overflow-x-auto">{SAMPLE_CSV}</pre>
          <pre className="mt-2 p-3 bg-muted rounded text-[11px] overflow-x-auto">{SAMPLE_CONV}</pre>
        </details>
      </Section>

      {preview && dedup && (
        <Section title={`Preview: ${preview.items.length} parsed`} desc={`Format: ${preview.format} · Skipped while parsing: ${preview.skipped}`}>
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded p-2 space-y-0.5">
              {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Fresh new" value={dedup.fresh.length} />
            <Stat label="Will merge" value={dedup.mergeable.length} hint="add variants" />
            <Stat label="Duplicates" value={dedup.duplicates.length} hint="will skip" />
            <Stat label="Total to apply" value={(skipDupes ? dedup.fresh.length : preview.items.length) + (autoMerge ? dedup.mergeable.length : 0)} />
          </div>

          {preview.items.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" /> No valid items parsed.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={skipDupes} onChange={e => setSkipDupes(e.target.checked)} />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={autoMerge} onChange={e => setAutoMerge(e.target.checked)} />
                  <GitMerge className="w-3 h-3" /> Auto-merge variants
                </label>
                <input
                  value={defaultCategory} onChange={e => setDefaultCategory(e.target.value)}
                  placeholder="Default category…"
                  className="px-2 py-1 rounded bg-background border border-border text-xs flex-1 min-w-[140px]"
                />
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-border border border-border rounded-md">
                {preview.items.slice(0, 100).map((it, i) => {
                  const isDup = dedup.duplicates.some(d => d.item === it);
                  const isMerge = dedup.mergeable.some(m => m.item === it);
                  const editing = editIdx === i;
                  return (
                    <div key={i} className="p-2 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {editing ? (
                            <>
                              <textarea
                                value={it.questions.join('\n')}
                                onChange={e => updateItem(i, { questions: e.target.value.split('\n') })}
                                rows={2}
                                className="w-full px-2 py-1 rounded bg-background border border-border text-xs font-mono mb-1"
                              />
                              <textarea
                                value={it.answer}
                                onChange={e => updateItem(i, { answer: e.target.value })}
                                rows={2}
                                className="w-full px-2 py-1 rounded bg-background border border-border text-xs"
                              />
                            </>
                          ) : (
                            <>
                              <div className="font-medium truncate">{it.questions[0]}</div>
                              <div className="text-muted-foreground truncate">{it.answer}</div>
                            </>
                          )}
                          <div className="flex gap-1.5 mt-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{it.category || 'general'}</span>
                            {isDup && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">duplicate</span>}
                            {isMerge && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">mergeable</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditIdx(editing ? null : i)} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{editing ? 'Done' : 'Edit'}</button>
                          <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {preview.items.length > 100 && <div className="p-2 text-xs text-center text-muted-foreground">+ {preview.items.length - 100} more (not previewed)</div>}
              </div>

              {uploading && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Uploading…</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setPreview(null)} disabled={uploading} className="px-3 py-1.5 rounded-md bg-muted text-sm">Discard</button>
                <button onClick={commit} disabled={uploading} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5 disabled:opacity-50">
                  <FileCheck2 className="w-4 h-4" /> Commit to Firebase
                </button>
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
