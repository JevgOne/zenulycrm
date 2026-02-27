import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { Users, Mail, TrendingUp, Target } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

const STAGE_COLORS: Record<string, string> = {
  new: 'text-text-muted', contacted: 'text-primary-light',
  responded: 'text-teal', meeting: 'text-accent',
  client: 'text-teal', lost: 'text-danger',
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    get('/dashboard/overview').then(setData);
  }, []);

  if (!data) return <div className="text-text-muted animate-pulse p-8">Načítám...</div>;

  const stageMap = Object.fromEntries(
    (data.stages || []).map((s: any) => [s.stage, s.count])
  );

  return (
    <div className="animate-page">
      <h1 className="heading-1 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard icon={<Users size={20} />} label="Celkem kontaktů" value={data.totalContacts} sub={`+${data.thisMonth} tento měsíc`} color="primary" />
        <KpiCard icon={<Target size={20} />} label="Průměrné skóre" value={data.avgScore} sub="/100 bodů" color="accent" />
        <KpiCard icon={<Mail size={20} />} label="Odesláno emailů" value={data.emailStats.totalSent} sub={`${data.emailStats.totalOpened} otevřeno`} color="teal" />
        <KpiCard icon={<TrendingUp size={20} />} label="Klienti" value={stageMap['client'] || 0} sub={`${stageMap['meeting'] || 0} ve schůzkách`} color="danger" />
      </div>

      {/* Pipeline overview */}
      <div className="card mb-6">
        <h2 className="heading-2 mb-4">Pipeline</h2>
        <div className="flex gap-2">
          {['new', 'contacted', 'responded', 'meeting', 'client', 'lost'].map(stage => (
            <div key={stage} className="flex-1 text-center p-3 rounded-lg bg-surface">
              <div className={`text-2xl font-bold ${STAGE_COLORS[stage] || 'text-text'}`}>
                {stageMap[stage] || 0}
              </div>
              <div className="text-[10px] font-mono text-text-dim mt-1 uppercase tracking-wider">
                {STAGE_LABELS[stage]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="heading-2 mb-4">Poslední aktivita</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-text-dim text-sm">Žádná aktivita</p>
        ) : (
          <div className="space-y-1">
            {data.recentActivity.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                <span className="text-[11px] font-mono text-text-dim w-36">
                  {new Date(a.created_at).toLocaleString('cs')}
                </span>
                <span className="font-medium text-text">{a.business_name || a.domain || 'Kontakt'}</span>
                <span className="text-text-muted">{a.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string;
  sub: string; color: string;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    teal: 'bg-teal/10 text-teal',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <div className="card-hover">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="label mb-0">{label}</span>
      </div>
      <div className="text-3xl font-semibold text-text">{value}</div>
      <div className="text-xs text-text-dim mt-1 font-mono">{sub}</div>
    </div>
  );
}
