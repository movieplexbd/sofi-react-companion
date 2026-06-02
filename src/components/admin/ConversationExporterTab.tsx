import { useState, useMemo } from 'react';
import { Download, Zap, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import {
  mineQAPairs,
  exportConversation,
  downloadExport,
  formatForImport,
  type MinedQAPair,
} from '../../engine/intelligence/conversationExporter';
import type { Message } from '../../types/sofia';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

export default function ConversationExporterTab({
  admin,
  messages,
}: {
  admin: Admin;
  messages: Message[];
}) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [minConfidence, setMinConfidence] = useState(0.6);
  const [mined, setMined] = useState<MinedQAPair[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const userMessages = messages.filter(m => m.sender === 'user').length;
    const botMessages = messages.filter(m => m.sender === 'bot').length;
    return { totalMessages, userMessages, botMessages };
  }, [messages]);

  function handleMine() {
    const pairs = mineQAPairs(messages, minConfidence);
    setMined(pairs);
    setSelectedPairs(new Set(pairs.map((_, i) => i)));
    toast.success(`Mined ${pairs.length} QA pairs`);
  }

  function handleExport() {
    try {
      const content = exportConversation(messages, {
        format,
        includeMetadata: true,
        minConfidence,
      });

      const ext = format === 'json' ? 'json' : 'csv';
      const filename = `sofia-export-${new Date().toISOString().split('T')[0]}.${ext}`;
      downloadExport(content, filename);
      toast.success(`Exported as ${filename}`);
    } catch (error) {
      toast.error('Export failed');
      console.error(error);
    }
  }

  async function handleImportSelected() {
    if (selectedPairs.size === 0) {
      toast.info('Select pairs to import');
      return;
    }

    setImporting(true);
    try {
      const toImport = mined.filter((_, i) => selectedPairs.has(i));
      const formatted = formatForImport(toImport);

      let imported = 0;
      for (const item of formatted) {
        try {
          await admin.addQA({
            questions: item.questions,
            answer: item.answer,
            category: item.category,
            tags: item.tags,
            feedback: { positive: 0, negative: 0 },
          });
          imported++;
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(`Imported ${imported}/${toImport.length} pairs`);
      await admin.reload();
      setMined([]);
      setSelectedPairs(new Set());
    } catch (error) {
      toast.error('Import failed');
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
    if (selectedPairs.size === mined.length) {
      setSelectedPairs(new Set());
    } else {
      setSelectedPairs(new Set(mined.map((_, i) => i)));
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="Conversation Export Trainer"
        desc="Extract QA pairs from chat history and export conversations."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Total messages" value={stats.totalMessages} />
          <Stat label="User questions" value={stats.userMessages} />
          <Stat label="Bot answers" value={stats.botMessages} />
          <Stat label="Mined pairs" value={mined.length} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-2">
              Min Confidence
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minConfidence}
              onChange={e => setMinConfidence(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(minConfidence * 100)}%
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-2">
              Export Format
            </label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value as 'json' | 'csv')}
              className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-6">
            <button
              onClick={handleMine}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4" /> Mine QA
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-md bg-muted text-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </Section>

      {mined.length > 0 && (
        <Section
          title={`Mined Pairs · ${mined.length}`}
          desc="Review and select pairs to import into knowledge base."
          action={
            <div className="flex gap-1">
              <button
                onClick={toggleAll}
                className="px-2.5 py-1 rounded text-xs bg-muted"
              >
                {selectedPairs.size === mined.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={handleImportSelected}
                disabled={selectedPairs.size === 0 || importing}
                className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Import {selectedPairs.size}
              </button>
            </div>
          }
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-96 overflow-y-auto">
            {mined.map((pair, i) => (
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
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      {pair.source}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
                      {Math.round(pair.confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(pair.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
