import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquarePlus, Upload, BookA, Brain,
  Tag, Settings, BarChart3, Lightbulb, ArrowLeft, Database, LogOut,
  Wrench, Save,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard' | 'qa' | 'bulk' | 'synonyms' | 'intents'
  | 'entities' | 'config' | 'analytics' | 'insights'
  | 'power' | 'backup';

interface Props {
  active: AdminTab;
  onSelect: (t: AdminTab) => void;
  onLogout: () => void;
  children: ReactNode;
}

const TABS: { id: AdminTab; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'qa', label: 'QA Manager', icon: MessageSquarePlus },
  { id: 'bulk', label: 'Bulk Upload', icon: Upload },
  { id: 'power', label: 'Power Tools', icon: Wrench },
  { id: 'backup', label: 'Backup', icon: Save },
  { id: 'synonyms', label: 'Synonyms', icon: BookA },
  { id: 'intents', label: 'Intents', icon: Brain },
  { id: 'entities', label: 'Entities', icon: Tag },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

export default function AdminShell({ active, onSelect, onLogout, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className={`${open ? 'block' : 'hidden'} md:block md:w-60 border-r border-border bg-card/40 backdrop-blur`}>
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Sofia Admin</div>
            <div className="text-[10px] text-muted-foreground">Master Control v1.0</div>
          </div>
        </div>
        <nav className="p-2 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { onSelect(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="p-2 mt-2 border-t border-border space-y-1">
          <Link to="/" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Chat
          </Link>
          <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-destructive/10 text-destructive">
            <LogOut className="w-4 h-4" /> Lock
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden p-3 border-b border-border flex items-center justify-between bg-card/40">
          <button onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded bg-muted text-sm">Menu</button>
          <div className="text-sm font-semibold">{TABS.find(t => t.id === active)?.label}</div>
          <div className="w-12" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
