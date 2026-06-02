import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import {
  createABTest,
  getActiveTest,
  getAllTests,
  analyzeTest,
  endTest,
  deleteTest,
  recordFeedback,
  type ABTest,
  type ABTestResult,
} from '../../engine/intelligence/abTestingEngine';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

export default function ABTestingTab({ admin }: { admin: Admin }) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [results, setResults] = useState<Map<string, ABTestResult>>(new Map());
  const [newTest, setNewTest] = useState({ qaKey: '', variantA: '', variantB: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    refreshTests();
    const interval = setInterval(refreshTests, 5000);
    return () => clearInterval(interval);
  }, []);

  function refreshTests() {
    const all = getAllTests();
    setTests(all);

    const newResults = new Map<string, ABTestResult>();
    for (const test of all) {
      const result = analyzeTest(test.id);
      if (result) newResults.set(test.id, result);
    }
    setResults(newResults);
  }

  function handleCreateTest() {
    if (!newTest.qaKey || !newTest.variantA || !newTest.variantB) {
      toast.error('Fill all fields');
      return;
    }

    if (newTest.variantA === newTest.variantB) {
      toast.error('Variants must be different');
      return;
    }

    createABTest(newTest.qaKey, newTest.variantA, newTest.variantB);
    toast.success('A/B test created');
    setNewTest({ qaKey: '', variantA: '', variantB: '' });
    setShowForm(false);
    refreshTests();
  }

  function handleEndTest(testId: string, winner: 'A' | 'B' | null) {
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    const winnerText = endTest(testId, winner);
    if (winner && winnerText) {
      toast.success(`Test ended. Winner (${winner}): ${winnerText.substring(0, 50)}...`);
    } else {
      toast.info('Test ended');
    }
    refreshTests();
  }

  function handleDeleteTest(testId: string) {
    if (confirm('Delete this test?')) {
      deleteTest(testId);
      toast.success('Test deleted');
      refreshTests();
    }
  }

  const activeTests = tests.filter(t => t.active);
  const completedTests = tests.filter(t => !t.active);

  return (
    <div className="space-y-4 max-w-4xl">
      <Section
        title="A/B Answer Testing"
        desc="Test two answer variants and automatically track which performs better."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Test
          </button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Active tests" value={activeTests.length} />
          <Stat label="Completed" value={completedTests.length} />
          <Stat label="Total tests" value={tests.length} />
        </div>

        {showForm && (
          <div className="mt-4 p-4 rounded border border-border bg-card/50 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                QA Key
              </label>
              <input
                type="text"
                placeholder="Firebase key or QA ID"
                value={newTest.qaKey}
                onChange={e => setNewTest({ ...newTest, qaKey: e.target.value })}
                className="w-full px-3 py-2 rounded bg-background border border-border text-sm"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                Variant A (Current)
              </label>
              <textarea
                placeholder="Current answer text"
                value={newTest.variantA}
                onChange={e => setNewTest({ ...newTest, variantA: e.target.value })}
                className="w-full px-3 py-2 rounded bg-background border border-border text-sm h-20 resize-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                Variant B (Test)
              </label>
              <textarea
                placeholder="Alternative answer text"
                value={newTest.variantB}
                onChange={e => setNewTest({ ...newTest, variantB: e.target.value })}
                className="w-full px-3 py-2 rounded bg-background border border-border text-sm h-20 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateTest}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
              >
                Create Test
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-md bg-muted text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {activeTests.length > 0 && (
        <Section title={`Active Tests · ${activeTests.length}`} desc="Tests currently running">
          <div className="space-y-3">
            {activeTests.map(test => {
              const result = results.get(test.id);
              const ctrA = test.stats.impressionsA > 0 ? test.stats.clicksA / test.stats.impressionsA : 0;
              const ctrB = test.stats.impressionsB > 0 ? test.stats.clicksB / test.stats.impressionsB : 0;

              return (
                <div key={test.id} className="p-3 rounded border border-border space-y-2">
                  <div className="text-xs space-y-1">
                    <div className="font-medium text-foreground">
                      {test.variantA.substring(0, 60)}...
                    </div>
                    <div className="text-muted-foreground">
                      vs. {test.variantB.substring(0, 60)}...
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-blue-500/10">
                      <div className="text-muted-foreground">Variant A</div>
                      <div className="font-mono">
                        {test.stats.impressionsA} imp · {test.stats.clicksA} clicks
                      </div>
                      <div className="text-blue-500 font-medium">
                        CTR: {(ctrA * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-purple-500/10">
                      <div className="text-muted-foreground">Variant B</div>
                      <div className="font-mono">
                        {test.stats.impressionsB} imp · {test.stats.clicksB} clicks
                      </div>
                      <div className="text-purple-500 font-medium">
                        CTR: {(ctrB * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {result && (
                    <div
                      className={`p-2 rounded text-xs flex items-start gap-2 ${
                        result.winner === 'tie'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      }`}
                    >
                      {result.winner === 'tie' ? (
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div>{result.recommendation}</div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {result && result.winner !== 'tie' && (
                      <>
                        <button
                          onClick={() => handleEndTest(test.id, result.winner)}
                          className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground flex items-center gap-1"
                        >
                          <TrendingUp className="w-3 h-3" /> Apply {result.winner}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleEndTest(test.id, null)}
                      className="px-2 py-1 rounded text-xs bg-muted"
                    >
                      End Test
                    </button>
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      className="px-2 py-1 rounded text-xs bg-destructive/10 text-destructive ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {completedTests.length > 0 && (
        <Section title={`Completed Tests · ${completedTests.length}`} desc="Finished tests">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {completedTests.map(test => (
              <div
                key={test.id}
                className="p-2 rounded bg-muted/30 text-xs flex justify-between items-center"
              >
                <div className="truncate">
                  {test.variantA.substring(0, 40)}... vs {test.variantB.substring(0, 40)}...
                </div>
                <button
                  onClick={() => handleDeleteTest(test.id)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
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
