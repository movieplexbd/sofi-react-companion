import { useState } from 'react';
import AdminShell, { type AdminTab } from '../components/admin/AdminShell';
import AdminLogin, { isUnlocked, lock } from '../components/admin/AdminLogin';
import DashboardTab from '../components/admin/DashboardTab';
import QATab from '../components/admin/QATab';
import BulkTab from '../components/admin/BulkTab';
import KeyListTab from '../components/admin/KeyListTab';
import ConfigTab from '../components/admin/ConfigTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import InsightsTab from '../components/admin/InsightsTab';
import PowerToolsTab from '../components/admin/PowerToolsTab';
import BackupTab from '../components/admin/BackupTab';
import { useAdmin } from '../hooks/useAdmin';
import { Toaster } from 'sonner';

export default function Admin() {
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const admin = useAdmin();

  if (!unlocked) return <AdminLogin onUnlock={() => setUnlocked(true)} />;

  return (
    <>
      <Toaster position="bottom-center" />
      <AdminShell
        active={tab}
        onSelect={setTab}
        onLogout={() => { lock(); setUnlocked(false); }}
      >
        {admin.busy && !Object.keys(admin.all.qaData || {}).length ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : tab === 'dashboard' ? <DashboardTab admin={admin} />
          : tab === 'qa' ? <QATab admin={admin} />
          : tab === 'bulk' ? <BulkTab admin={admin} />
          : tab === 'power' ? <PowerToolsTab admin={admin} />
          : tab === 'backup' ? <BackupTab admin={admin} />
          : tab === 'synonyms' ? <KeyListTab admin={admin} path="synonymMap" title="Synonyms" desc="Map a canonical word to its variants. Used for query expansion." />
          : tab === 'intents' ? <KeyListTab admin={admin} path="intents" title="Intents" desc="Pattern / keyword groups that trigger specific responses." valueLabel='JSON: {"keywords":["..."],"responses":["..."]}' singleValue />
          : tab === 'entities' ? <KeyListTab admin={admin} path="entities" title="Entities" desc="Named-entity groups (people, places, products)." />
          : tab === 'config' ? <ConfigTab admin={admin} />
          : tab === 'analytics' ? <AnalyticsTab admin={admin} />
          : tab === 'insights' ? <InsightsTab admin={admin} />
          : null}
      </AdminShell>
    </>
  );
}
