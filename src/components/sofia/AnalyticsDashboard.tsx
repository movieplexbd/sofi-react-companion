import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import type { RuntimeState } from '../../types/sofia';
import type { IntelligenceAPI } from '../../engine/intelligence';

interface AnalyticsDashboardProps {
  visible: boolean;
  onClose: () => void;
  runtime: RuntimeState;
  intel?: IntelligenceAPI | null;
}

const COLORS = ['#6A1B9A', '#AD1457', '#0277BD', '#2E7D32', '#E65100', '#C62828', '#4527A0'];

export default function AnalyticsDashboard({ visible, onClose, runtime, intel }: AnalyticsDashboardProps) {
  const stats = runtime.stats;
  const history = runtime.history;
  const [kgTab, setKgTab] = useState<'view' | 'add'>('view');
  const [newEntity, setNewEntity] = useState({ name: '', categories: '', relations: '' });

  // Method distribution from history
  const methodData = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach(h => {
      const cat = h.category || 'unknown';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [history]);

  // Messages over session (simulated timeline)
  const timelineData = useMemo(() => {
    const buckets: Record<string, number> = {};
    history.forEach(h => {
      const min = new Date(h.time).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
      buckets[min] = (buckets[min] || 0) + 1;
    });
    return Object.entries(buckets).slice(-10).map(([time, count]) => ({ time, count }));
  }, [history]);

  const handleExport = (format: 'json' | 'csv') => {
    if (!intel) return;
    const diag = intel.getDiagnostics();
    const exportData = {
      timestamp: new Date().toISOString(),
      stats: runtime.stats,
      topQueries: diag.feedback.topQueries,
      clickedResults: diag.feedback.topClicked,
      engineWeights: diag.weights,
      cacheStats: diag.cache,
      memoryUsage: diag.memory.usage,
      graphSize: diag.graphSize,
      history: runtime.history
    };

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      filename = `sofia-analytics-${Date.now()}.json`;
    } else {
      const rows = [
        ['Type', 'Key/Query', 'Value/Count'],
        ['Memory Usage', '', diag.memory.usage],
        ['Graph Size', '', diag.graphSize],
        ...Object.entries(diag.weights).map(([k, v]) => ['Engine Weight', k, v]),
        ...diag.feedback.topQueries.map(q => ['Top Query', q.query, q.count]),
        ...diag.feedback.topClicked.map(c => ['Top Clicked', c.key, c.clicks])
      ];
      const csvContent = rows.map(r => r.join(',')).join('\n');
      blob = new Blob([csvContent], { type: 'text/csv' });
      filename = `sofia-analytics-${Date.now()}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddEntity = () => {
    if (!intel || !newEntity.name) return;
    intel.graph.addEntity(
      newEntity.name,
      newEntity.categories.split(',').map(s => s.trim()).filter(Boolean),
      newEntity.relations.split(',').map(s => s.trim()).filter(Boolean)
    );
    setNewEntity({ name: '', categories: '', relations: '' });
    setKgTab('view');
    intel.clearCaches(); // Apply changes immediately
  };

  const rate = stats.totalMessages > 0 ? Math.round(stats.matchedCount / stats.totalMessages * 100) : 0;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 max-w-lg w-[90%] max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary">📊 Analytics Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={() => handleExport('json')} className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/80">JSON</button>
            <button onClick={() => handleExport('csv')} className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/80">CSV</button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl ml-2">✕</button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'মোট Message', value: stats.totalMessages },
            { label: 'Match Rate', value: `${rate}%` },
            { label: 'Avg Score', value: `${Math.round(stats.avgScore)}%` },
            { label: 'No Match', value: stats.noMatchCount },
          ].map((s, i) => (
            <div key={i} className="bg-background rounded-xl p-3 text-center border border-border">
              <div className="text-xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Intelligence Diagnostics */}
        {intel && (() => {
          const diag = intel.getDiagnostics();
          const weightData = Object.entries(diag.weights).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
          return (
            <div className="mt-5 space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-primary">🧠 Intelligence Layer</h3>

              {/* Engine weights */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">Adaptive Engine Weights</h4>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 2.5]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(280 70% 36%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cache stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background rounded-lg p-2 border border-border text-center">
                  <div className="text-xs text-muted-foreground">Result Cache Hit</div>
                  <div className="text-sm font-bold text-primary">{Math.round(diag.cache.result.hitRate * 100)}%</div>
                  <div className="text-[10px] text-muted-foreground">{diag.cache.result.size}/{diag.cache.result.capacity}</div>
                </div>
                <div className="bg-background rounded-lg p-2 border border-border text-center">
                  <div className="text-xs text-muted-foreground">Query Cache Hit</div>
                  <div className="text-sm font-bold text-primary">{Math.round(diag.cache.query.hitRate * 100)}%</div>
                  <div className="text-[10px] text-muted-foreground">{diag.cache.query.size}/{diag.cache.query.capacity}</div>
                </div>
              </div>

              {/* Memory & Graph Info */}
              <div className="bg-secondary/20 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Memory Usage:</span> <b>{diag.memory.usage} bytes</b></div>
                <div className="flex justify-between"><span>Graph Entities:</span> <b>{diag.graphSize}</b></div>
                <div className="flex justify-between"><span>Current Topic:</span> <b>{diag.memory.currentTopic || '—'}</b></div>
              </div>

              {/* Knowledge Graph UI */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex bg-muted text-[10px] font-bold uppercase tracking-wider">
                  <button onClick={() => setKgTab('view')} className={`flex-1 py-2 ${kgTab === 'view' ? 'bg-background text-primary' : 'text-muted-foreground'}`}>View Graph</button>
                  <button onClick={() => setKgTab('add')} className={`flex-1 py-2 ${kgTab === 'add' ? 'bg-background text-primary' : 'text-muted-foreground'}`}>Add Entity</button>
                </div>
                <div className="p-3 bg-background min-h-[120px] max-h-[200px] overflow-y-auto">
                  {kgTab === 'view' ? (
                    <div className="space-y-2">
                      {diag.graph?.slice(-10).reverse().map((n: any, i: number) => (
                        <div key={i} className="text-xs border-b border-border pb-1 flex justify-between items-start">
                          <div>
                            <div className="font-bold text-primary">{n.name}</div>
                            <div className="text-[10px] text-muted-foreground">{n.categories.join(', ')}</div>
                          </div>
                          <button 
                            onClick={() => { intel.graph.deleteEntity(n.name); intel.clearCaches(); }}
                            className="text-destructive hover:opacity-70"
                          >✕</button>
                        </div>
                      ))}
                      {(!diag.graph || diag.graph.length === 0) && <div className="text-center text-muted-foreground py-4">No entities yet</div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input 
                        placeholder="Entity Name (e.g. Dhaka)" 
                        className="w-full text-xs p-1.5 border border-border rounded bg-background"
                        value={newEntity.name}
                        onChange={e => setNewEntity({...newEntity, name: e.target.value})}
                      />
                      <input 
                        placeholder="Categories (comma separated)" 
                        className="w-full text-xs p-1.5 border border-border rounded bg-background"
                        value={newEntity.categories}
                        onChange={e => setNewEntity({...newEntity, categories: e.target.value})}
                      />
                      <input 
                        placeholder="Relations (comma separated)" 
                        className="w-full text-xs p-1.5 border border-border rounded bg-background"
                        value={newEntity.relations}
                        onChange={e => setNewEntity({...newEntity, relations: e.target.value})}
                      />
                      <button 
                        onClick={handleAddEntity}
                        className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded"
                      >Add to Graph</button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => { intel.resetLearning(); onClose(); }}
                className="w-full text-xs py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
              >
                Reset learning + caches
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
