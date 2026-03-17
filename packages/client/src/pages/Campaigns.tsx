import { useEffect, useState } from 'react';
import { get, post, del } from '../api/client';
import { Plus, Mail, Trash2, Play, Sparkles, Loader2 } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    get('/campaigns').then(setCampaigns);
    get('/templates').then(setTemplates);
  }, []);

  const reload = () => get('/campaigns').then(setCampaigns);

  return (
    <div className="animate-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="heading-1">Kampaně</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Nová kampaň
        </button>
      </div>

      <div className="space-y-3">
        {campaigns.map(c => (
          <div key={c.id} className="card flex items-center justify-between">
            <div>
              <div className="font-semibold text-text">{c.name}</div>
              <div className="text-sm text-text-muted">
                Šablona: {c.template_name || '-'} |
                Status: <span className={
                  c.status === 'completed' ? 'text-teal'
                  : c.status === 'running' ? 'text-primary-light'
                  : 'text-text-muted'
                }>{c.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-text">{c.total_sent}</div>
                <div className="text-xs text-text-dim">odesláno</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-teal">{c.total_opened}</div>
                <div className="text-xs text-text-dim">otevřeno</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary-light">{c.total_clicked}</div>
                <div className="text-xs text-text-dim">kliknuto</div>
              </div>
              {c.status === 'draft' && (
                <button onClick={async () => { await post(`/campaigns/${c.id}/send`, {}); reload(); }}
                  className="btn-primary text-sm flex items-center gap-1">
                  <Play size={14} /> Odeslat
                </button>
              )}
              <button onClick={async () => { await del(`/campaigns/${c.id}`); reload(); }}
                className="text-danger/60 hover:text-danger">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="text-center text-text-dim py-12">
            Žádné kampaně. Vytvoř novou kampaň pro oslovení leadů.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCampaignModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ templates, onClose, onCreated }: {
  templates: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [filters, setFilters] = useState({ stage: [] as string[], minScore: 0, category: '', city: '' });

  const handleCreate = async () => {
    await post('/campaigns', {
      name,
      template_id: useAi ? null : Number(templateId),
      filter_json: { ...filters, use_ai_email: useAi },
    });
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface2 rounded-2xl border border-border-light p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-text mb-4">Nová kampaň</h2>
        <div className="space-y-3">
          <input placeholder="Název kampaně" value={name}
            onChange={e => setName(e.target.value)}
            className="input w-full" />

          {/* AI or Template toggle */}
          <div className="flex gap-2">
            <button onClick={() => setUseAi(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                !useAi ? 'bg-primary text-white' : 'bg-border text-text-muted hover:bg-surface2'
              }`}>
              <Mail size={14} /> Šablona
            </button>
            <button onClick={() => setUseAi(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                useAi ? 'bg-primary text-white' : 'bg-border text-text-muted hover:bg-surface2'
              }`}>
              <Sparkles size={14} /> AI Email
            </button>
          </div>

          {useAi ? (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-sm text-text-muted">
                Claude AI napíše unikátní email pro každý kontakt na základě dat z analýzy webu.
              </p>
            </div>
          ) : (
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="input w-full">
              <option value="">Vybrat šablonu...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          <div>
            <label className="label">Minimální score:</label>
            <input type="number" value={filters.minScore}
              onChange={e => setFilters({...filters, minScore: Number(e.target.value)})}
              className="input w-full" />
          </div>

          <input placeholder="Obor (volitelné)" value={filters.category}
            onChange={e => setFilters({...filters, category: e.target.value})}
            className="input w-full" />

          <input placeholder="Město (volitelné)" value={filters.city}
            onChange={e => setFilters({...filters, city: e.target.value})}
            className="input w-full" />

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Zrušit</button>
            <button onClick={handleCreate} disabled={!name || (!useAi && !templateId)} className="btn-primary">
              Vytvořit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
