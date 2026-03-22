import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import type { RuntimeState } from '../../types/sofia';

interface AnalyticsDashboardProps {
  visible: boolean;
  onClose: () => void;
  runtime: RuntimeState;
}

const COLORS = ['#6A1B9A', '#AD1457', '#0277BD', '#2E7D32', '#E65100', '#C62828', '#4527A0'];

export default function AnalyticsDashboard({ visible, onClose, runtime }: AnalyticsDashboardProps) {
  const stats = runtime.stats;
  const history = runtime.history;

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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl">✕</button>
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

        {/* Category pie chart */}
        {methodData.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Top Categories</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={methodData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name }) => name}>
                  {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Timeline */}
        {timelineData.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Messages Over Time</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(280 70% 36%)" strokeWidth={2} dot={{ fill: 'hsl(280 70% 36%)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
