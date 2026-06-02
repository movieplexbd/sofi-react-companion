import { useEffect, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Section, Stat } from './Stat';
import type { useAdmin } from '../../hooks/useAdmin';

type Admin = ReturnType<typeof useAdmin>;

const BACKUPS_KEY = 'sofia-admin-backups-v1';
const MAX_LOCAL = 10;

interface LocalBackup { id: string; createdAt: number; size: number; data: any; note?: string; }

function loadLocal(): LocalBackup[] {
  try { return JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'); } catch { return []; }
}
function saveLocal(list: LocalBackup[]) {
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)));
}

export default function BackupTab({ admin }: { admin: Admin }) {
  const [backups, setBackups] = useState<LocalBackup[]>(loadLocal());
  const [note, setNote] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => { setBackups(loadLocal()); }, []);

  async function snapshotNow() {
    try {
      const data = await admin.snapshot();
      const str = JSON.stringify(data);
      const entry: LocalBackup = {
        id: String(Date.now()), createdAt: Date.now(), size: str.length, data, note: note.trim() || undefined,
      };
      const next = [entry, ...backups].slice(0, MAX_LOCAL);
      setBackups(next); saveLocal(next); setNote('');
      toast.success(`Snapshot saved (${formatBytes(str.length)})`);
    } catch (e: any) { toast.error(e?.message); }
  }

  function downloadBackup(b: LocalBackup) {
    const blob = new Blob([JSON.stringify(b.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `sofia-backup-${new Date(b.createdAt).toISOString()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function downloadFresh() {
    const data = await admin.snapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `sofia-full-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Full backup downloaded');
  }

  async function restoreFromBackup(b: LocalBackup) {
    if (!confirm(`Restore from ${new Date(b.createdAt).toLocaleString()} using ${restoreMode.toUpperCase()} mode?\n${restoreMode === 'replace' ? 'This will REPLACE current data!' : 'Existing data will be kept; backup data merged in.'}`)) return;
    setRestoring(true);
    try {
      await admin.restore(b.data, restoreMode);
      await admin.reload();
      toast.success('Restore complete');
    } catch (e: any) { toast.error(e?.message); }
    finally { setRestoring(false); }
  }

  function removeBackup(id: string) {
    const next = backups.filter(b => b.id !== id);
    setBackups(next); saveLocal(next);
  }

  async function uploadRestore(file: File) {
    if (!confirm(`Restore from "${file.name}" using ${restoreMode.toUpperCase()} mode?`)) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await admin.restore(data, restoreMode);
      await admin.reload();
      toast.success('Restored from file');
    } catch (e: any) { toast.error(e?.message); }
    finally { setRestoring(false); }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Save className="w-4 h-4" />} label="Local snapshots" value={backups.length} hint={`max ${MAX_LOCAL}`} />
        <Stat label="QA entries" value={Object.keys(admin.all.qaData || {}).length} />
        <Stat label="Synonyms" value={Object.keys(admin.all.synonymMap || {}).length} />
        <Stat label="Intents" value={Object.keys(admin.all.intents || {}).length} />
      </div>

      <Section title="Create snapshot" desc="Saves the entire bot state to your browser. Use before any risky operation.">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note (e.g. before-bulk-import)"
            className="px-3 py-2 rounded-md bg-background border border-border text-sm" />
          <button onClick={snapshotNow} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Snapshot
          </button>
          <button onClick={downloadFresh} className="px-3 py-2 rounded-md bg-muted text-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </Section>

      <Section
        title="Restore"
        desc="Restore from a saved snapshot or uploaded backup."
        action={
          <select value={restoreMode} onChange={e => setRestoreMode(e.target.value as any)}
            className="px-2 py-1 rounded bg-background border border-border text-xs">
            <option value="merge">Merge (safe)</option>
            <option value="replace">Replace (destructive)</option>
          </select>
        }
      >
        <label className="block border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 text-sm">
          <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          Upload backup .json
          <input type="file" accept=".json" className="hidden"
            onChange={e => e.target.files?.[0] && uploadRestore(e.target.files[0])} />
        </label>

        {restoreMode === 'replace' && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" /> Replace mode wipes existing collections — make a snapshot first.
          </div>
        )}

        <div className="divide-y divide-border border border-border rounded-md max-h-72 overflow-y-auto">
          {backups.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No local snapshots yet.</div>}
          {backups.map(b => (
            <div key={b.id} className="p-2.5 flex items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{new Date(b.createdAt).toLocaleString()}</div>
                <div className="text-muted-foreground">{formatBytes(b.size)}{b.note ? ` · ${b.note}` : ''}</div>
              </div>
              <button disabled={restoring} onClick={() => restoreFromBackup(b)} className="px-2 py-1 rounded bg-primary text-primary-foreground flex items-center gap-1 disabled:opacity-50">
                <RotateCcw className="w-3 h-3" /> Restore
              </button>
              <button onClick={() => downloadBackup(b)} className="px-2 py-1 rounded bg-muted flex items-center gap-1">
                <Download className="w-3 h-3" />
              </button>
              <button onClick={() => removeBackup(b.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
