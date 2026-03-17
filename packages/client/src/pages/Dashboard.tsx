import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Users, Mail, TrendingUp, Target, ArrowUpRight, ArrowDownRight,
  Clock, BarChart3, Zap, ChevronRight, Sparkles, Activity,
  Send, Inbox, CheckCircle2, AlertTriangle, MousePointerClick, XCircle, Ban
} from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

const STAGE_COLORS: Record<string, string> = {
  new: '#7a7891', contacted: '#7b6cff', responded: '#44d4c8',
  meeting: '#c8ff6a', client: '#44d4c8', lost: '#ff6b6b',
};

const STAGE_BG: Record<string, string> = {
  new: 'bg-text-muted/10', contacted: 'bg-primary/10',
  responded: 'bg-teal/10', meeting: 'bg-accent/10',
  client: 'bg-teal/10', lost: 'bg-danger/10',
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    get('/dashboard/overview').then(setData);
  }, []);

  if (!data) return (
    <div className="animate-pulse p-8 space-y-6">
      <div className="h-8 w-48 bg-surface2 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-surface2 rounded-xl" />)}
      </div>
      <div className="h-48 bg-surface2 rounded-xl" />
    </div>
  );

  const stageMap = Object.fromEntries(
    (data.stages || []).map((s: any) => [s.stage, s.count])
  );

  const totalInPipeline = Object.values(stageMap).reduce((a: number, b: any) => a + (b || 0), 0) as number;
  const conversionRate = totalInPipeline > 0
    ? ((stageMap['client'] || 0) / totalInPipeline * 100).toFixed(1)
    : '0';
  const openRate = data.emailStats.totalSent > 0
    ? ((data.emailStats.totalOpened / data.emailStats.totalSent) * 100).toFixed(0)
    : '0';

  return (
    <div className="animate-page space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Dashboard</h1>
          <p className="text-sm text-text-dim mt-1">Přehled vašeho CRM</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/scanner')}
            className="btn-secondary flex items-center gap-2 !py-2 !px-4"
          >
            <Zap size={14} />
            Scanner
          </button>
          <button
            onClick={() => navigate('/admin/campaigns')}
            className="btn-primary flex items-center gap-2 !py-2 !px-4"
          >
            <Sparkles size={14} />
            Nová kampaň
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={<Users size={20} />}
          label="Celkem kontaktů"
          value={data.totalContacts.toLocaleString('cs')}
          sub={`+${data.thisMonth} tento měsíc`}
          trend={data.thisMonth > 0 ? 'up' : 'neutral'}
          color="primary"
        />
        <KpiCard
          icon={<Target size={20} />}
          label="Průměrné skóre"
          value={data.avgScore}
          sub="/100 bodů"
          trend={data.avgScore >= 50 ? 'up' : 'down'}
          color="accent"
        />
        <KpiCard
          icon={<Mail size={20} />}
          label="Odesláno emailů"
          value={data.emailStats.totalSent.toLocaleString('cs')}
          sub={`${openRate}% otevřeno`}
          trend={Number(openRate) > 20 ? 'up' : 'neutral'}
          color="teal"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Konverze"
          value={`${conversionRate}%`}
          sub={`${stageMap['client'] || 0} klientů`}
          trend={Number(conversionRate) > 0 ? 'up' : 'neutral'}
          color="danger"
        />
      </div>

      {/* Pipeline + Email Stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary-light" />
              <h2 className="heading-2">Pipeline</h2>
            </div>
            <button
              onClick={() => navigate('/admin/pipeline')}
              className="text-xs text-text-dim hover:text-primary-light transition-colors flex items-center gap-1"
            >
              Zobrazit vše <ChevronRight size={12} />
            </button>
          </div>

          {/* Pipeline bar */}
          <div className="flex h-10 rounded-lg overflow-hidden mb-4">
            {['new', 'contacted', 'responded', 'meeting', 'client', 'lost'].map(stage => {
              const count = stageMap[stage] || 0;
              const pct = totalInPipeline > 0 ? (count / totalInPipeline) * 100 : 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={stage}
                  style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[stage] }}
                  className="relative group transition-all hover:brightness-110"
                  title={`${STAGE_LABELS[stage]}: ${count}`}
                >
                  {pct > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-bg">
                      {count.toLocaleString('cs')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pipeline numbers */}
          <div className="grid grid-cols-6 gap-2">
            {['new', 'contacted', 'responded', 'meeting', 'client', 'lost'].map(stage => (
              <div key={stage} className={`text-center p-3 rounded-lg ${STAGE_BG[stage]} transition-all hover:scale-105 cursor-default`}>
                <div className="text-xl font-bold text-text" style={{ color: STAGE_COLORS[stage] }}>
                  {(stageMap[stage] || 0).toLocaleString('cs')}
                </div>
                <div className="text-[9px] font-mono text-text-dim mt-1 uppercase tracking-wider">
                  {STAGE_LABELS[stage]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email stats */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <Mail size={18} className="text-teal" />
            <h2 className="heading-2">Emaily</h2>
          </div>

          <div className="flex-1 space-y-3">
            <StatRow label="Odesláno" value={data.emailStats.totalSent} color="text-text" />
            <StatRow label="Otevřeno" value={data.emailStats.totalOpened} color="text-teal" />
            <StatRow label="Kliknuto" value={data.emailStats.totalClicked} color="text-accent" />

            {data.emailStats.totalSent > 0 && (
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between text-xs text-text-dim mb-1.5">
                  <span>Open rate</span>
                  <span className="text-teal font-mono">{openRate}%</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal to-accent rounded-full transition-all"
                    style={{ width: `${Math.min(100, Number(openRate))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {data.emailStats.totalSent === 0 && (
            <div className="mt-auto pt-4">
              <button
                onClick={() => navigate('/admin/campaigns')}
                className="w-full btn-primary !py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <Sparkles size={12} />
                Vytvořit kampaň
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Denní odesílání + Sekvence + Emailový marketing */}
      <div className="grid grid-cols-3 gap-4">
        {/* Denní limit */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Send size={18} className="text-teal" />
            <h2 className="heading-2">Denní odesílání</h2>
          </div>

          {(() => {
            const pct = data.dailySendLimit > 0 ? (data.sentToday / data.dailySendLimit) * 100 : 0;
            const isWarning = pct >= 80;
            return (
              <div className="space-y-3">
                <div className="text-3xl font-bold text-text font-mono">
                  {data.sentToday} <span className="text-lg text-text-dim">/ {data.dailySendLimit}</span>
                </div>
                <div className="h-3 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isWarning ? 'bg-accent' : 'bg-teal'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="text-xs text-text-dim">Ve frontě: {data.queuedEmails}</p>
                {(data.failedEmails || 0) > 0 && (
                  <p className="text-xs text-danger">Selhalo: {data.failedEmails}</p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Weblyx Outreach sekvence */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={18} className="text-primary-light" />
            <h2 className="heading-2">Weblyx Outreach</h2>
          </div>

          {(!data.outreachStats || Object.keys(data.outreachStats).length === 0) ? (
            <div className="text-center py-8">
              <Mail size={32} className="mx-auto text-text-dim/30 mb-3" />
              <p className="text-sm text-text-dim">Žádná sekvence</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.outreachStats.active != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Aktivních:</span>
                  <span className="text-sm font-bold font-mono text-teal">{data.outreachStats.active || 0}</span>
                </div>
              )}
              {data.outreachStats.completed != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Dokončených:</span>
                  <span className="text-sm font-bold font-mono text-accent">{data.outreachStats.completed || 0}</span>
                </div>
              )}
              {data.outreachStats.cancelled != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Zrušených:</span>
                  <span className="text-sm font-bold font-mono text-text-dim">{data.outreachStats.cancelled || 0}</span>
                </div>
              )}
              {!data.outreachStats.active && !data.outreachStats.completed && !data.outreachStats.cancelled && (
                <div className="text-center py-4">
                  <p className="text-sm text-text-dim">Žádná sekvence</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Emailový marketing přehled */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-accent" />
            <h2 className="heading-2">Emailový marketing</h2>
          </div>

          {(() => {
            const totalSent = data.emailStats.totalSent || 0;
            const totalOpened = data.emailStats.totalOpened || 0;
            const totalClicked = data.emailStats.totalClicked || 0;
            const openPct = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';
            const clickPct = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0';
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Celkem odesláno:</span>
                  <span className="text-sm font-bold font-mono text-text">{totalSent.toLocaleString('cs')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Otevřeno:</span>
                  <span className="text-sm font-bold font-mono text-teal">{totalOpened.toLocaleString('cs')} ({openPct}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Kliknuto:</span>
                  <span className="text-sm font-bold font-mono text-accent">{totalClicked.toLocaleString('cs')} ({clickPct}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Odhlášených:</span>
                  <span className="text-sm font-bold font-mono text-text-dim">{(data.unsubscribes || 0).toLocaleString('cs')}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Activity + Reminders */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent activity */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-primary-light" />
            <h2 className="heading-2">Poslední aktivita</h2>
          </div>
          {data.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity size={32} className="mx-auto text-text-dim/30 mb-3" />
              <p className="text-sm text-text-dim">Zatím žádná aktivita</p>
              <p className="text-xs text-text-dim/60 mt-1">Začněte oslovovat kontakty</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {data.recentActivity.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 text-sm py-2.5 border-b border-border last:border-0 hover:bg-surface/50 rounded px-2 -mx-2 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary-light shrink-0" />
                  <span className="text-[11px] font-mono text-text-dim w-28 shrink-0">
                    {new Date(a.created_at).toLocaleString('cs', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-text truncate">{a.business_name || a.contact_name || a.contact_email || a.domain || (() => { try { return JSON.parse(a.details)?.to; } catch { return null; } })() || 'Kontakt'}</span>
                  <span className="text-text-muted text-xs truncate">{a.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming reminders */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-accent" />
            <h2 className="heading-2">Připomínky</h2>
          </div>
          {(!data.upcomingReminders || data.upcomingReminders.length === 0) ? (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto text-text-dim/30 mb-3" />
              <p className="text-sm text-text-dim">Žádné připomínky</p>
              <p className="text-xs text-text-dim/60 mt-1">Připomínky se zobrazí zde</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {data.upcomingReminders.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm py-2.5 border-b border-border last:border-0 hover:bg-surface/50 rounded px-2 -mx-2 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-[11px] font-mono text-text-dim w-28 shrink-0">
                    {new Date(r.due_at).toLocaleString('cs', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-text truncate">{r.business_name || r.domain || 'Kontakt'}</span>
                  <span className="text-text-muted text-xs truncate">{r.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: number | string;
  sub: string; color: string; trend: 'up' | 'down' | 'neutral';
}) {
  const colors: Record<string, string> = {
    primary: 'from-primary/20 to-primary/5 text-primary-light',
    accent: 'from-accent/15 to-accent/5 text-accent',
    teal: 'from-teal/15 to-teal/5 text-teal',
    danger: 'from-danger/15 to-danger/5 text-danger',
  };
  const iconBg: Record<string, string> = {
    primary: 'bg-primary/15 text-primary-light',
    accent: 'bg-accent/15 text-accent',
    teal: 'bg-teal/15 text-teal',
    danger: 'bg-danger/15 text-danger',
  };
  return (
    <div className="relative overflow-hidden card-hover group">
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[color]} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg[color]}`}>{icon}</div>
          {trend === 'up' && <ArrowUpRight size={16} className="text-teal" />}
          {trend === 'down' && <ArrowDownRight size={16} className="text-danger" />}
        </div>
        <div className="text-3xl font-bold text-text tracking-tight">{value}</div>
        <div className="text-xs text-text-dim mt-1.5 font-mono">{sub}</div>
        <div className="label mt-2 !mb-0 !text-[9px]">{label}</div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className={`text-lg font-bold font-mono ${color}`}>{value.toLocaleString('cs')}</span>
    </div>
  );
}
