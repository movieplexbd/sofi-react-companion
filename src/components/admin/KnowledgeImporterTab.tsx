import { useState } from 'react';
import { Download, Plus, Trash2, Loader, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import {
  extractContentFromUrl,
  generateQAFromContent,
  importFromUrls,
  formatImportedForDB,
  type ImportedQAPair,
} from '../../engine/intelligence/knowledgeImporter';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

export default function KnowledgeImporterTab({ admin }: { admin: Admin }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [imported, setImported] = useState<ImportedQAPair[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [importing, setImporting] = useState(false);

  function addUrl() {
    const url = urlInput.trim();
    if (!url) {
      toast.error('Enter a URL');
      return;
    }
    try {
      new URL(url);
      if (!urls.includes(url)) {
        setUrls([...urls, url]);
        setUrlInput('');
        toast.success('URL added');
      } else {
        toast.info('URL already added');
      }
    } catch {
      toast.error('Invalid URL');
    }
  }

  function removeUrl(idx: number) {
    setUrls(urls.filter((_, i) => i !== idx));
  }

  async function handleImport() {
    if (urls.length === 0) {
      toast.error('Add at least one URL');
      return;
    }

    setLoading(true);
    setProgress('Starting import...');
    try {
      const pairs = await importFromUrls(urls, (current, total, status) => {
        setProgress(`${status} (${current}/${total})`);
      });

      setImported(pairs);
      setSelectedPairs(new Set(pairs.map((_, i) => i)));
      setProgress('');
      toast.success(`Imported ${pairs.length} QA pairs`);
    } catch (error) {
      toast.error('Import failed');
      console.error(error);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToKB() {
    if (selectedPairs.size === 0) {
      toast.info('Select pairs to add');
      return;
    }

    setImporting(true);
    try {
      const toAdd = imported.filter((_, i) => selectedPairs.has(i));
      const formatted = formatImportedForDB(toAdd);

      let added = 0;
      for (const item of formatted) {
        try {
          await admin.addQA({
            questions: item.questions,
            answer: item.answer,
            category: item.category,
            tags: item.tags,
            feedback: { positive: 0, negative: 0 },
          });
          added++;
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(`Added ${added}/${toAdd.length} pairs to knowledge base`);
      await admin.reload();
      setImported([]);
      setSelectedPairs(new Set());
      setUrls([]);
    } catch (error) {
      toast.error('Failed to add pairs');
      console.error(error);
    } finally {
      setImporting(false);
    }
  }

  function togglePair(idx: number) {
    const next = new Set(selectedPairs);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedPairs(next);
  }

  function toggleAll() {
    if (selectedPairs.size === imported.length) {
      setSelectedPairs(new Set());
    } else {
      setSelectedPairs(new Set(imported.map((_, i) => i)));
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="Knowledge Import from URL"
        desc="Scrape Wikipedia, blogs, and documentation to auto-generate QA pairs."
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://en.wikipedia.org/wiki/..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addUrl()}
              className="flex-1 px-3 py-2 rounded bg-background border border-border text-sm"
            />
            <button
              onClick={addUrl}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            >
              Add
            </button>
          </div>

          {urls.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                URLs to import ({urls.length})
              </div>
              <div className="space-y-1">
                {urls.map((url, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs"
                  >
                    <span className="truncate text-muted-foreground">{url}</span>
                    <button
                      onClick={() => removeUrl(i)}
                      className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleImport}
              disabled={urls.length === 0 || loading}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Start Import
                </>
              )}
            </button>
          </div>

          {progress && (
            <div className="p-2 rounded bg-blue-500/10 text-blue-500 text-xs flex items-center gap-2">
              <Loader className="w-3 h-3 animate-spin" />
              {progress}
            </div>
          )}
        </div>
      </Section>

      {imported.length > 0 && (
        <Section
          title={`Imported Pairs · ${imported.length}`}
          desc="Review and select pairs to add to knowledge base."
          action={
            <div className="flex gap-1">
              <button
                onClick={toggleAll}
                className="px-2.5 py-1 rounded text-xs bg-muted"
              >
                {selectedPairs.size === imported.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={handleAddToKB}
                disabled={selectedPairs.size === 0 || importing}
                className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Add {selectedPairs.size}
              </button>
            </div>
          }
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-96 overflow-y-auto">
            {imported.map((pair, i) => (
              <div
                key={i}
                className="p-3 text-xs space-y-1.5 hover:bg-muted/30 cursor-pointer"
                onClick={() => togglePair(i)}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPairs.has(i)}
                    onChange={() => togglePair(i)}
                    className="mt-0.5 accent-primary"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground truncate">
                      <span className="text-foreground font-medium">Q:</span> {pair.question}
                    </div>
                    <div className="text-muted-foreground truncate mt-1">
                      <span className="text-foreground font-medium">A:</span> {pair.answer.substring(0, 100)}...
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-6">
                  <div className="flex gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[10px]">
                      {pair.source}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[10px]">
                      {Math.round(pair.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Import Tips" desc="Best practices for knowledge import">
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li>• Wikipedia articles work best — well-structured content</li>
          <li>• Blog posts with clear headings generate better QA pairs</li>
          <li>• Avoid very long pages (may timeout)</li>
          <li>• Review confidence scores before importing</li>
          <li>• Imported pairs are tagged for easy filtering</li>
        </ul>
      </Section>
    </div>
  );
}
