import { useState, useMemo } from 'react';
import { AlertTriangle, Zap, Check, Trash2, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import {
  findIgnoredAnswers,
  generateRewriteSuggestions,
  flagAnswer,
  getFlaggedAnswers,
  clearFlag,
  type IgnoredAnswer,
  type RewriteSuggestion,
} from '../../engine/intelligence/negativeFeedbackRewriter';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

export default function NegativeFeedbackRewriterTab({ admin }: { admin: Admin }) {
  const [ignored, setIgnored] = useState<IgnoredAnswer[]>([]);
  const [suggestions, setSuggestions] = useState<RewriteSuggestion[]>([]);
  const [flagged, setFlagged] = useState(getFlaggedAnswers());
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [ignoreThreshold, setIgnoreThreshold] = useState(0.5);

  const stats = useMemo(() => {
    return {
      totalIgnored: ignored.length,
      highSeverity: ignored.filter(i => i.severity === 'high').length,
      flaggedCount: flagged.length,
    };
  }, [ignored, flagged]);

  function handleAnalyze() {
    const qaData = admin.all.qaData || {};
    const ignoredAnswers = findIgnoredAnswers(qaData, ignoreThreshold);
    setIgnored(ignoredAnswers);

    if (ignoredAnswers.length === 0) {
      toast.info('No ignored answers found');
      return;
    }

    const rewrites = generateRewriteSuggestions(ignoredAnswers);
    setSuggestions(rewrites);
    setSelectedSuggestions(new Set(rewrites.map((_, i) => i)));
    toast.success(`Found ${ignoredAnswers.length} ignored answers, ${rewrites.length} suggestions`);
  }

  async function applySelectedRewrites() {
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
          await admin.updateQA(sugg.qaKey, { answer: sugg.suggestedRewrite });
          applied++;
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(`Applied ${applied}/${toApply.length} rewrites`);
      await admin.reload();
      setSuggestions([]);
      setSelectedSuggestions(new Set());
    } catch (error) {
      toast.error('Failed to apply rewrites');
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

  function toggleAll() {
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestions.map((_, i) => i)));
    }
  }

  function handleFlagAnswer(ignored: IgnoredAnswer) {
    flagAnswer(
      ignored.qaKey,
      ignored.question,
      ignored.answer,
      `High ignore rate: ${Math.round(ignored.ignoreRate * 100)}%`
    );
    setFlagged(getFlaggedAnswers());
    toast.success('Answer flagged for review');
  }

  function handleClearFlag(qaKey: string) {
    clearFlag(qaKey);
    setFlagged(getFlaggedAnswers());
    toast.success('Flag cleared');
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="Negative Feedback Rewriter"
        desc="Identify repeatedly ignored answers and suggest improvements."
        action={
          <button
            onClick={handleAnalyze}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4" /> Analyze
          </button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Ignored answers" value={stats.totalIgnored} />
          <Stat label="High severity" value={stats.highSeverity} />
          <Stat label="Suggestions" value={suggestions.length} />
          <Stat label="Flagged" value={stats.flaggedCount} />
        </div>

        <div className="pt-4">
          <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-2">
            Ignore Rate Threshold
          </label>
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={ignoreThreshold}
            onChange={e => setIgnoreThreshold(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Show answers with {Math.round(ignoreThreshold * 100)}%+ ignore rate
          </div>
        </div>
      </Section>

      {ignored.length > 0 && (
        <Section
          title={`Ignored Answers · ${ignored.length}`}
          desc="Answers users are ignoring most often."
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-96 overflow-y-auto">
            {ignored.map((item, i) => (
              <div key={i} className="p-3 text-xs space-y-1.5">
                <div className="flex items-start gap-2">
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      item.severity === 'high'
                        ? 'bg-red-500/10 text-red-500'
                        : item.severity === 'medium'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground truncate">
                      <span className="text-foreground font-medium">Q:</span> {item.question}
                    </div>
                    <div className="text-muted-foreground truncate mt-1">
                      <span className="text-foreground font-medium">A:</span> {item.answer.substring(0, 80)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pl-8">
                  <div className="flex gap-2 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                      {item.ignoreCount} ignores
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
                      {item.clickCount} clicks
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted">
                      {Math.round(item.ignoreRate * 100)}% ignore rate
                    </span>
                  </div>
                  <button
                    onClick={() => handleFlagAnswer(item)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {suggestions.length > 0 && (
        <Section
          title={`Rewrite Suggestions · ${suggestions.length}`}
          desc="AI-generated improvements for ignored answers."
          action={
            <div className="flex gap-1">
              <button
                onClick={toggleAll}
                className="px-2.5 py-1 rounded text-xs bg-muted"
              >
                {selectedSuggestions.size === suggestions.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={applySelectedRewrites}
                disabled={selectedSuggestions.size === 0 || applying}
                className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> Apply {selectedSuggestions.size}
              </button>
            </div>
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
                      <span className="text-foreground font-medium">Original:</span>
                    </div>
                    <div className="text-muted-foreground truncate">
                      {sugg.originalAnswer.substring(0, 100)}...
                    </div>

                    <div className="text-muted-foreground truncate mt-2">
                      <span className="text-foreground font-medium">Suggested:</span>
                    </div>
                    <div className="text-green-500 truncate">
                      {sugg.suggestedRewrite.substring(0, 100)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pl-6">
                  <div className="flex gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px]">
                      {sugg.reason}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[10px]">
                      {Math.round(sugg.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {flagged.length > 0 && (
        <Section
          title={`Flagged for Review · ${flagged.length}`}
          desc="Answers manually flagged for attention."
        >
          <div className="divide-y divide-border border border-border rounded-md max-h-40 overflow-y-auto">
            {flagged.map((flag, i) => (
              <div key={i} className="p-2 text-xs flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground truncate">{flag.question}</div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">{flag.reason}</div>
                </div>
                <button
                  onClick={() => handleClearFlag(flag.qaKey)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
