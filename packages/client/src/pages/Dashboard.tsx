import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { Users, Mail, TrendingUp, Target } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    get('/dashboard/overview').then(setData);
  }, []);

  if (!data) return <div className="animate-pulse">Načítám...</div>;

  const stageMap = Object.fromEntries(
    (data.stages || []).map((s: any) => [s.stage, s.count])
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={<Users size={20} />}
          label="Celkem kontaktů"
          value={data.totalContacts}
          sub={`+${data.thisMonth} tento měsíc`}
          color="blue"
        />
        <KpiCard
          icon={<Target size={20} />}
          label="Průměrné skóre"
          value={data.avgScore}
          sub="/100 bodů"
          color="orange"
        />
        <KpiCard
          icon={<Mail size={20} />}
          label="Odesláno emailů"
          value={data.emailStats.totalSent}
          sub={`${data.emailStats.totalOpened} otevřeno`}
          color="green"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Klienti"
          value={stageMap['client'] || 0}
          sub={`${stageMap['meeting'] || 0} ve schůzkách`}
          color="purple"
        />
      </div>

      {/* Pipeline overview */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <h2 className="font-semibold mb-4">Pipeline</h2>
        <div className="flex gap-2">
          {['new', 'contacted', 'responded', 'meeting', 'client', 'lost'].map(stage => (
            <div key={stage} className="flex-1 text-center p-3 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold">{stageMap[stage] || 0}</div>
              <div className="text-xs text-gray-500 mt-1">{STAGE_LABELS[stage]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="font-semibold mb-4">Poslední aktivita</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-gray-400 text-sm">Žádná aktivita</p>
        ) : (
          <div className="space-y-2">
            {data.recentActivity.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                <span className="text-xs text-gray-400 w-32">
                  {new Date(a.created_at).toLocaleString('cs')}
                </span>
                <span className="font-medium">{a.business_name || a.domain || 'Kontakt'}</span>
                <span className="text-gray-500">{a.title}</span>
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
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${colors[color]}`}>{icon}</div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
