import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Users, Mail, TrendingUp, ArrowUpRight,
  Clock, BarChart3, Zap, ChevronRight, Sparkles,
  Send, MousePointerClick, Eye, Ban, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Novy', contacted: 'Osloveny', responded: 'Odpovedel',
  meeting: 'Schuzka', client: 'Klient', lost: 'Ztraceny',
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

const EMAIL_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  sent: { label: 'Odeslano', color: 'text-text-muted', icon: CheckCircle2 },
  opened: { label: 'Otevreno', color: 'text-teal', icon: Eye },
  clicked: { label: 'Kliknuto', color: 'text-accent', icon: MousePointerClick },
  failed: { label: 'Selhalo', color: 'text-danger', icon: XCircle },
  skipped: { label: 'Preskoceno', color: 'text-text-dim', icon: Ban },
  processing: { label: 'Odesila se...', color: 'text-accent', icon: Send },
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

  const { emailStats } = data;

  return (
    <div className="animate-page space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Dashboard</h1>
          <p className="text-sm text-text-dim mt-1">Prehled vaseho CRM</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/scanner')} className="btn-secondary flex items-center gap-2 !py-2 !px-4">
            <Zap size={14} /> Scanner
          </button>
          <button onClick={() => navigate('/admin/campaigns')} className="btn-primary flex items-center gap-2 !py-2 !px-4">
            <Sparkles size={14} /> Nova kampan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={<Send size={20} />}
          label="Odeslano dnes"
          value={data.sentToday}
          sub={`z ${data.dailySendLimit} limitu`}
          trend={data.sentToday > 0 ? 'up' : 'neutral'}
          color="accent"
        />
        <KpiCard
          icon={<Mail size={20} />}
          label="Celkem odeslano"
          value={emailStats.totalSent.toLocaleString('cs')}
          sub={`${data.queuedEmails} ve fronte`}
          trend="neutral"
          color="primary"
        />
        <KpiCard
          icon={<Eye size={20} />}
          label="Otevreno"
          value={emailStats.totalOpened.toLocaleString('cs')}
          sub={`${emailStats.openRate}% open rate`}
          trend={emailStats.openRate > 1 ? 'up' : 'neutral'}
          color="teal"
        />
        <KpiCard
          icon={<Users size={20} />}
          label="Kontaktu"
          value={data.totalContacts.toLocaleString('cs')}
          sub={`${(data.contacted || 0).toLocaleString('cs')} osloveno`}
          trend="neutral"
          color="danger"
        />
      </div>

      {/* Email log table - MAIN SECTION */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-primary-light" />
            <h2 className="heading-2">Posledni odeslane emaily</h2>
          </div>
          <span className="text-xs text-text-dim font-mono">poslednich 50</span>
        </div>
        {(data.recentEmails || []).length === 0 ? (
          <div className="text-center py-12">
            <Mail size={36} className="mx-auto text-text-dim/30 mb-3" />
            <p className="text-sm text-text-dim">Zatim zadne odeslane emaily</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 pr-4 text-[10px] font-mono text-text-dim uppercase tracking-wider">Cas</th>
                  <th className="pb-3 pr-4 text-[10px] font-mono text-text-dim uppercase tracking-wider">Firma / Email</th>
                  <th className="pb-3 pr-4 text-[10px] font-mono text-text-dim uppercase tracking-wider">Predmet</th>
                  <th className="pb-3 pr-4 text-[10px] font-mono text-text-dim uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-[10px] font-mono text-text-dim uppercase tracking-wider">Otevreno</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentEmails || []).map((e: any) => {
                  const st = EMAIL_STATUS[e.status] || EMAIL_STATUS.sent;
                  const Icon = st.icon;
                  const name = e.business_name || e.contact_name || e.domain || e.to_email;
                  return (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                      <td className="py-2.5 pr-4 text-[11px] font-mono text-text-dim whitespace-nowrap">
                        {e.sent_at ? new Date(e.sent_at).toLocaleString('cs', {
                          day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-text truncate max-w-[200px]" title={name}>{name}</div>
                        <div className="text-[10px] text-text-dim font-mono">{e.to_email}</div>
                      </td>
                      <td className="py-2.5 pr-4 text-text-muted truncate max-w-[250px]" title={e.subject}>
                        {e.subject}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs ${st.color}`}>
                          <Icon size={12} />
                          {st.label}
                        </span>
                        {e.error && e.status === 'failed' && (
                          <div className="text-[10px] text-danger/70 mt-0.5 truncate max-w-[150px]" title={e.error}>{e.error}</div>
                        )}
                      </td>
                      <td className="py-2.5 whitespace-nowrap text-[11px] font-mono text-text-dim">
                        {e.opened_at ? new Date(e.opened_at).toLocaleString('cs', {
                          day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Denni graf + Pipeline + Denni limit */}
      <div className="grid grid-cols-3 gap-4">
        {/* Denni graf */}
        {(data.sentByDay || []).length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-teal" />
              <h2 className="heading-2">Poslednich 7 dni</h2>
            </div>
            <div className="flex items-end gap-2 h-28">
              {(() => {
                const maxCount = Math.max(...(data.sentByDay || []).map((d: any) => d.count), 1);
                return (data.sentByDay || []).map((d: any) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-text-dim">{d.count}</span>
                    <div
                      className="w-full bg-teal/60 rounded-t"
                      style={{ height: `${Math.max(4, (d.count / maxCount) * 90)}px` }}
                    />
                    <span className="text-[9px] text-text-dim font-mono">
                      {new Date(d.day + 'T00:00:00').toLocaleDateString('cs', { day: 'numeric', month: 'numeric' })}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Pipeline mini */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-light" />
              <h2 className="heading-2">Pipeline</h2>
            </div>
            <button
              onClick={() => navigate('/admin/pipeline')}
              className="text-xs text-text-dim hover:text-primary-light transition-colors flex items-center gap-1"
            >
              Detail <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {['new', 'contacted', 'responded', 'meeting', 'client', 'lost'].map(stage => {
              const count = stageMap[stage] || 0;
              if (count === 0) return null;
              const pct = totalInPipeline > 0 ? (count / totalInPipeline) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-[11px] text-text-muted">{STAGE_LABELS[stage]}</span>
                  <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[stage] }} />
                  </div>
                  <span className="font-mono text-xs text-text w-16 text-right">{count.toLocaleString('cs')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Denni limit */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Send size={18} className="text-teal" />
            <h2 className="heading-2">Denni limit</h2>
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
                <div className="flex justify-between text-xs text-text-dim">
                  <span>Ve fronte: {data.queuedEmails}</span>
                  <span>Zbyva: {data.remainingToday}</span>
                </div>
                {(data.failedEmails || 0) > 0 && (
                  <p className="text-xs text-danger flex items-center gap-1">
                    <AlertTriangle size={11} /> Selhalo: {data.failedEmails}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Email stats + Sekvence + Pripominky */}
      <div className="grid grid-cols-3 gap-4">
        {/* Email vykon */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-accent" />
            <h2 className="heading-2">Emaily celkem</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted flex items-center gap-1.5"><Mail size={13} /> Odeslano</span>
              <span className="text-sm font-bold font-mono text-text">{emailStats.totalSent.toLocaleString('cs')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted flex items-center gap-1.5"><Eye size={13} /> Otevreno</span>
              <span className="text-sm font-bold font-mono text-teal">{emailStats.totalOpened.toLocaleString('cs')} ({emailStats.openRate}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted flex items-center gap-1.5"><MousePointerClick size={13} /> Kliknuto</span>
              <span className="text-sm font-bold font-mono text-accent">{emailStats.totalClicked.toLocaleString('cs')} ({emailStats.clickRate}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted flex items-center gap-1.5"><Ban size={13} /> Odhlaseni</span>
              <span className="text-sm font-bold font-mono text-text-dim">{(data.unsubscribes || 0).toLocaleString('cs')}</span>
            </div>
            {emailStats.totalSent > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-xs text-text-dim mb-1.5">
                  <span>Open rate</span>
                  <span className="text-teal font-mono">{emailStats.openRate}%</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal to-accent rounded-full" style={{ width: `${Math.min(100, emailStats.openRate)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sekvence */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary-light" />
            <h2 className="heading-2">Sekvence</h2>
          </div>
          {(data.sequenceProgress || []).length === 0 ? (
            <div className="text-center py-6">
              <Mail size={28} className="mx-auto text-text-dim/30 mb-2" />
              <p className="text-sm text-text-dim">Zadna sekvence</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data.sequenceProgress || []).map((step: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-text-muted truncate flex-1" title={step.template_name}>
                    {step.template_name?.replace(/^\d+\s*/, '').replace(/^-\s*/, '')}
                  </span>
                  <span className="font-mono text-xs text-text-dim">{(step.waiting || 0).toLocaleString('cs')}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2 flex justify-between text-xs text-text-dim">
                <span>Aktivni: <strong className="text-teal">{(data.outreachStats?.active || 0).toLocaleString('cs')}</strong></span>
                <span>Hotovo: <strong className="text-accent">{(data.outreachStats?.completed || 0).toLocaleString('cs')}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Pripominky */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-accent" />
            <h2 className="heading-2">Pripominky</h2>
          </div>
          {(!data.upcomingReminders || data.upcomingReminders.length === 0) ? (
            <div className="text-center py-6">
              <Clock size={28} className="mx-auto text-text-dim/30 mb-2" />
              <p className="text-sm text-text-dim">Zadne pripominky</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {data.upcomingReminders.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                  <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-[11px] font-mono text-text-dim w-20 shrink-0">
                    {new Date(r.due_at).toLocaleString('cs', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-text truncate">{r.business_name || r.contact_name || r.domain || 'Kontakt'}</span>
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
        </div>
        <div className="text-3xl font-bold text-text tracking-tight">{value}</div>
        <div className="text-xs text-text-dim mt-1.5 font-mono">{sub}</div>
        <div className="label mt-2 !mb-0 !text-[9px]">{label}</div>
      </div>
    </div>
  );
}
