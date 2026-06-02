import { useState, useMemo } from 'react';
import { AlertCircle, TrendingDown, Settings, BarChart3 } from 'lucide-react';
import { Section, Stat } from './Stat';
import {
  evaluateConfidence,
  getFallbackStats,
  generateSearchQuery,
  recordFallbackUsage,
  type FallbackStats,
} from '../../engine/intelligence/confidenceFallback';

export default function ConfidenceFallbackTab() {
  const [testScore, setTestScore] = useState(0.5);
  const [fallbackStats, setFallbackStats] = useState<FallbackStats[]>(getFallbackStats());

  const result = useMemo(() => evaluateConfidence(testScore), [testScore]);

  const stats = useMemo(() => {
    const total = fallbackStats.reduce((sum, s) => sum + s.usedCount, 0);
    const successful = fallbackStats.reduce((sum, s) => sum + s.successCount, 0);
    return {
      totalUsed: total,
      successfulUsed: successful,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) : 0,
      strategies: fallbackStats.length,
    };
  }, [fallbackStats]);

  const confidenceColors: Record<string, string> = {
    high: 'bg-green-500/10 text-green-500',
    medium: 'bg-blue-500/10 text-blue-500',
    low: 'bg-yellow-500/10 text-yellow-500',
    critical: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="Confidence-based Fallback Chain"
        desc="When answer confidence is low, suggest related QA, web search, or teach mode."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Total fallbacks used" value={stats.totalUsed} />
          <Stat label="Successful" value={stats.successfulUsed} />
          <Stat label="Success rate" value={`${stats.successRate}%`} />
          <Stat label="Strategies" value={stats.strategies} />
        </div>

        <div className="mt-6 p-4 rounded border border-border bg-card/50 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-3">
              Test Confidence Score
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={testScore}
              onChange={e => setTestScore(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-sm font-mono mt-2">{testScore.toFixed(2)}</div>
          </div>

          <div
            className={`p-3 rounded ${confidenceColors[result.level]}`}
          >
            <div className="font-medium mb-1">Confidence Level: {result.level.toUpperCase()}</div>
            <div className="text-sm">{result.recommendation}</div>
          </div>

          {result.fallbacks.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Suggested Fallbacks
              </div>
              <div className="space-y-1">
                {result.fallbacks.map((fb, i) => {
                  const fbStats = fallbackStats.find(s => s.type === fb.type);
                  const successRate = fbStats
                    ? ((fbStats.successCount / fbStats.usedCount) * 100).toFixed(0)
                    : 'N/A';

                  return (
                    <div
                      key={i}
                      className="p-2 rounded bg-muted/50 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{fb.message}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">
                          {fb.type} · Priority {fb.priority}
                        </div>
                      </div>
                      {fbStats && (
                        <div className="text-right text-[10px]">
                          <div className="font-mono">{successRate}% success</div>
                          <div className="text-muted-foreground">{fbStats.usedCount} uses</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Fallback Strategy Performance" desc="How effective each strategy is">
        {fallbackStats.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No fallback usage data yet. Use fallback strategies to collect metrics.
          </div>
        ) : (
          <div className="space-y-3">
            {fallbackStats
              .sort((a, b) => (b.successCount / b.usedCount) - (a.successCount / a.usedCount))
              .map((stat, i) => {
                const successRate = (stat.successCount / stat.usedCount) * 100;
                return (
                  <div key={i} className="p-3 rounded border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{stat.type}</div>
                      <div className="text-xs font-mono">
                        {stat.successCount}/{stat.usedCount} successful
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${successRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{successRate.toFixed(1)}% success rate</span>
                      <span>Last used: {new Date(stat.lastUsed).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Section>

      <Section title="Fallback Strategies" desc="Available fallback options">
        <div className="space-y-2 text-xs">
          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">1. Related QA (Confidence &lt; 70%)</div>
            <div className="text-muted-foreground">
              Show questions from same category or with similar tags
            </div>
          </div>

          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">2. Web Search (Confidence &lt; 50%)</div>
            <div className="text-muted-foreground">
              Suggest searching the web for more information
            </div>
          </div>

          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">3. Teach Mode (Confidence &lt; 30%)</div>
            <div className="text-muted-foreground">
              Invite user to teach Sofia the correct answer
            </div>
          </div>

          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">4. Ask Clarification (Confidence &lt; 60%)</div>
            <div className="text-muted-foreground">
              Request more details to better understand the question
            </div>
          </div>

          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">5. History (Always available)</div>
            <div className="text-muted-foreground">
              Show similar questions user asked before
            </div>
          </div>
        </div>
      </Section>

      <Section title="Example Search Queries" desc="How questions are converted to web searches">
        <div className="space-y-2 text-xs">
          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">Input:</div>
            <div className="text-muted-foreground">What is machine learning and how does it work?</div>
            <div className="font-medium mb-1 mt-2">Search Query:</div>
            <div className="text-blue-500 font-mono">machine learning work</div>
          </div>

          <div className="p-2 rounded bg-muted/50">
            <div className="font-medium mb-1">Input:</div>
            <div className="text-muted-foreground">কৃত্রিম বুদ্ধিমত্তা কী?</div>
            <div className="font-medium mb-1 mt-2">Search Query:</div>
            <div className="text-blue-500 font-mono">কৃত্রিম বুদ্ধিমত্তা</div>
          </div>
        </div>
      </Section>
    </div>
  );
}
