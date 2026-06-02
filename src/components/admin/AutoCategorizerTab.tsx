import { useState, useMemo } from 'react';
import { Zap, Plus, Merge2, AlertCircle, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import {
  suggestCategories,
  clusterByContent,
  findMergeCandidates,
  type CategorySuggestion,
  type Cluster,
  type MergeProposal,
} from '../../engine/intelligence/autoCategorizer';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

export default function AutoCategorizerTab({ admin }: { admin: Admin }) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [merges, setMerges] = useState<MergeProposal[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [selectedMerges, setSelectedMerges] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'suggest' | 'cluster' | 'merge'>('suggest');
  const [applying, setApplying] = useState(false);

  const stats = useMemo(() => {
    const uncategorized = Object.entries(admin.all.qaData || {}).filter(
      ([, v]: any) => !v.category || v.category.trim() === ''
    ).length;
    const categorized = Object.entries(admin.all.qaData || {}).filter(
      ([, v]: any) => v.category && v.category.trim() !== ''
    ).length;
    return { uncategorized, categorized };
  }, [admin.all.qaData]);

  function handleSuggest() {
    const qaData = admin.all.qaData || {};
    const uncategorized = Object.entries(qaData)
      .filter(([, v]: any) => !v.category || v.category.trim() === '')
      .map(([k, v]: any) => ({
        key: k,
        question: v.questions?.[0] || v.question || '',
        answer: v.answer || '',
      }));

    const categorized = Object.entries(qaData)
      .filter(([, v]: any) => v.category && v.category.trim() !== '')
      .map(([k, v]: any) => ({
        key: k,
        question: v.questions?.[0] || v.question || '',
        category: v.category,
      }));

    if (uncategorized.length === 0) {
      toast.info('No uncategorized items');
      return;
    }

    if (categorized.length === 0) {
      toast.info('Need at least some categorized items for suggestions');
      return;
    }

    const sugg = suggestCategories(uncategorized, categorized);
    setSuggestions(sugg);
    setSelectedSuggestions(new Set(sugg.map((_, i) => i)));
    toast.success(`Generated ${sugg.length} suggestions`);
  }

  function handleCluster() {
    const qaData = admin.all.qaData || {};
    const items = Object.entries(qaData)
      .filter(([, v]: any) => !v.category || v.category.trim() === '')
      .map(([k, v]: any) => ({
        key: k,
        question: v.questions?.[0] || v.question || '',
      }));

    if (items.length === 0) {
      toast.info('No uncategorized items to cluster');
      return;
    }

    const clust = clusterByContent(items, 0.35);
    setClusters(clust);
    toast.success(`Found ${clust.length} clusters`);
  }

  function handleFindMerges() {
    const qaData = admin.all.qaData || {};
    const items = Object.entries(qaData).map(([k, v]: any) => ({
      key: k,
      question: v.questions?.[0] || v.question || '',
    }));

    if (items.length < 2) {
      toast.info('Need at least 2 items');
      return;
    }

    const proposals = findMergeCandidates(items, 0.80);
    setMerges(proposals);
    setSelectedMerges(new Set(proposals.map((_, i) => i)));
    toast.success(`Found ${proposals.length} merge candidates`);
  }

  async function applySelectedSuggestions() {
    if (selectedSuggestions.size === 0) {
      toast.info('Select suggestions to apply');
      return;
    }

    setApplying(true);
    try {
      const toApply = suggestions.filter((_, i) => selectedSuggestions.has(i));
      let applied = 0;

      for (const sugg of toApply) {
        try {
          await admin.updateQA(sugg.qaKey, { category: sugg.suggestedCategory });
          applied++;
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(`Applied ${applied}/${toApply.length} suggestions`);
      await admin.reload();
      setSuggestions([]);
      setSelectedSuggestions(new Set());
    } catch (error) {
      toast.error('Failed to apply suggestions');
      console.error(error);
    } finally {
      setApplying(false);
    }
  }

  async function applySelectedMerges() {
    if (selectedMerges.size === 0) {
      toast.info('Select merges to apply');
      return;
    }

    setApplying(true);
    try {
      const toApply = merges.filter((_, i) => selectedMerges.has(i));
      let merged = 0;

      for (const proposal of toApply) {
        try {
          const source = admin.all.qaData?.[proposal.sourceKey];
          const target = admin.all.qaData?.[proposal.targetKey];

          if (source && target) {
            const sourceQuestions = source.questions || [source.question || ''];
            const targetQuestions = target.questions || [target.question || ''];
            const merged = [...new Set([...targetQuestions, ...sourceQuestions])];

            await admin.updateQA(proposal.targetKey, { questions: merged });
            await admin.deleteQA(proposal.sourceKey);
            merged++;
          }
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(`Merged ${merged}/${toApply.length} items`);
      await admin.reload();
      setMerges([]);
      setSelectedMerges(new Set());
    } catch (error) {
      toast.error('Failed to apply merges');
      console.error(error);
    } finally {
      setApplying(false);
    }
  }

  function toggleSuggestion(idx: number) {
    const next = new Set(selectedSuggestions);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedSuggestions(next);
  }

  function toggleMerge(idx: number) {
    const next = new Set(selectedMerges);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedMerges(next);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="Auto Category Clustering"
        desc="Automatically organize uncategorized QA pairs using similarity analysis."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Uncategorized" value={stats.uncategorized} />
          <Stat label="Categorized" value={stats.categorized} />
          <Stat label="Suggestions" value={suggestions.length} />
          <Stat label="Clusters" value={clusters.length} />
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSuggest}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
              tab === 'suggest'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
            onClick={() => setTab('suggest')}
          >
            <Lightbulb className="w-4 h-4" /> Suggest
          </button>
          <button
            onClick={handleCluster}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
              tab === 'cluster'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
            onClick={() => setTab('cluster')}
          >
            <Zap className="w-4 h-4" /> Cluster
          </button>
          <button
            onClick={handleFindMerges}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
              tab === 'merge'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
            onClick={() => setTab('merge')}
          >
            <Merge2 className="w-4 h-4" /> Merge
          </button>
        </div>
      </Section>

      {tab === 'suggest' && suggestions.length > 0 && (
        <Section
          title={`Category Suggestions · ${suggestions.length}`}
          desc="Review and apply suggested categories for uncategorized items."
          action={
            <button
              onClick={applySelectedSuggestions}
              disabled={selectedSuggestions.size === 0 || applying}
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Apply {selectedSuggestions.size}
            </button>
          }
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-96 overflow-y-auto">
            {suggestions.map((sugg, i) => (
              <div
                key={i}
                className="p-3 text-xs space-y-1.5 hover:bg-muted/30 cursor-pointer"
                onClick={() => toggleSuggestion(i)}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(i)}
                    onChange={() => toggleSuggestion(i)}
                    className="mt-0.5 accent-primary"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground truncate">
                      <span className="text-foreground font-medium">Q:</span> {sugg.question}
                    </div>
                    <div className="text-muted-foreground truncate mt-1">
                      <span className="text-foreground font-medium">A:</span> {sugg.answer.substring(0, 80)}...
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-6">
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">
                      → {sugg.suggestedCategory}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      {Math.round(sugg.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'cluster' && clusters.length > 0 && (
        <Section title={`Clusters · ${clusters.length}`} desc="Grouped uncategorized items">
          <div className="space-y-3">
            {clusters.map((cluster, i) => (
              <div key={i} className="p-3 rounded border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{cluster.suggestedName}</div>
                    <div className="text-xs text-muted-foreground">
                      {cluster.items.length} items · {Math.round(cluster.avgSimilarity * 100)}% avg similarity
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {cluster.items.slice(0, 3).map((item, j) => (
                    <div key={j} className="text-xs text-muted-foreground truncate pl-3">
                      • {item.question}
                    </div>
                  ))}
                  {cluster.items.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-3">
                      +{cluster.items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'merge' && merges.length > 0 && (
        <Section
          title={`Merge Candidates · ${merges.length}`}
          desc="Highly similar items that could be merged."
          action={
            <button
              onClick={applySelectedMerges}
              disabled={selectedMerges.size === 0 || applying}
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <Merge2 className="w-3 h-3" /> Merge {selectedMerges.size}
            </button>
          }
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-96 overflow-y-auto">
            {merges.map((merge, i) => (
              <div
                key={i}
                className="p-3 text-xs space-y-1.5 hover:bg-muted/30 cursor-pointer"
                onClick={() => toggleMerge(i)}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedMerges.has(i)}
                    onChange={() => toggleMerge(i)}
                    className="mt-0.5 accent-primary"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground truncate">
                      {merge.sourceQuestion}
                    </div>
                    <div className="text-muted-foreground text-[10px] mt-1">↓ merge into</div>
                    <div className="text-foreground font-medium truncate">
                      {merge.targetQuestion}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-6">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">
                    {Math.round(merge.similarity * 100)}% similar
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
