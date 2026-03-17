import { useEffect, useState } from 'react';
import { get, post, put, del } from '../api/client';
import { Plus, Edit2, Trash2, Eye, Sparkles, Loader2 } from 'lucide-react';

const DEFAULT_TEMPLATE = `<p>Dobrý den{{kontakt ? ', ' + kontakt : ''}},</p>

<p>při průzkumu firem v oblasti <strong>{{obor}}</strong> v {{mesto}} mě zaujaly vaše stránky <strong>{{web}}</strong>.</p>

<p>Všiml jsem si dvou věcí, které vás mohou stát zákazníky:</p>
{{problemy_html}}

<p>Vaše stránka získala <strong>{{score}}/100</strong> v testu zastaralosti — to znamená, že potenciální zákazníci mohou odcházet ke konkurenci s modernějším webem.</p>

<p>Stojí vám to za 15 minut? Rád vám ukážu, co konkrétně zlepšit.</p>

<p>S pozdravem,<br/>{{odesilatel}}<br/>Weblyx.cz | info@weblyx.cz</p>`;

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiContactId, setAiContactId] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    get('/templates').then(setTemplates);
  }, []);

  const reload = () => get('/templates').then(setTemplates);

  const handleSave = async () => {
    if (editing.id) {
      await put(`/templates/${editing.id}`, editing);
    } else {
      await post('/templates', editing);
    }
    setEditing(null);
    reload();
  };

  const handlePreview = async (id: number) => {
    const data = await post(`/templates/${id}/preview`, {});
    setPreview(data);
  };

  const handleAiGenerate = async () => {
    if (!aiContactId) return;
    setAiGenerating(true);
    try {
      const result: any = await post('/ai/generate-email', { contact_id: Number(aiContactId) });
      setEditing({
        name: `AI: ${result.subject.substring(0, 40)}`,
        subject: result.subject,
        body_html: result.body_html,
        body_text: result.body_text,
        category: 'ai-generated',
      });
      setShowAiModal(false);
      setAiContactId('');
    } catch (err: any) {
      alert(`Chyba AI: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="animate-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="heading-1">Email šablony</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAiModal(true)} className="btn-secondary flex items-center gap-1.5">
            <Sparkles size={16} /> AI Generovat
          </button>
          <button onClick={() => setEditing({
            name: '', subject: '{{firma}} - Vaše webová stránka má {{pocet_problemu}} problémů',
            body_html: DEFAULT_TEMPLATE, category: ''
          })} className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Nová šablona
          </button>
        </div>
      </div>

      {/* Available variables */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-primary-light text-sm mb-2">Dostupné proměnné:</h3>
        <div className="flex flex-wrap gap-2">
          {['firma', 'web', 'kontakt', 'email', 'mesto', 'obor', 'score',
            'problemy', 'pocet_problemu', 'copyright', 'cms', 'rychlost',
            'mobilni', 'ssl', 'odesilatel'].map(v => (
            <code key={v} className="bg-primary/15 text-primary-light font-mono px-2 py-0.5 rounded text-xs">
              {`{{${v}}}`}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="card flex items-center justify-between">
            <div>
              <div className="font-semibold text-text">{t.name}</div>
              <div className="text-sm text-text-muted">Předmět: {t.subject}</div>
              {t.category && <div className="text-xs text-text-dim">Obor: {t.category}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handlePreview(t.id)} className="p-2 text-text-dim hover:text-primary-light">
                <Eye size={16} />
              </button>
              <button onClick={() => setEditing(t)} className="p-2 text-text-dim hover:text-primary">
                <Edit2 size={16} />
              </button>
              <button onClick={async () => { await del(`/templates/${t.id}`); reload(); }}
                className="p-2 text-text-dim hover:text-danger">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-center text-text-dim py-12">
            Žádné šablony. Vytvoř novou šablonu pro oslovování leadů.
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-surface2 rounded-2xl border border-border-light p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text mb-4">{editing.id ? 'Upravit šablonu' : 'Nová šablona'}</h2>
            <div className="space-y-3">
              <input placeholder="Název šablony" value={editing.name}
                onChange={e => setEditing({...editing, name: e.target.value})}
                className="input w-full" />
              <input placeholder="Předmět emailu" value={editing.subject}
                onChange={e => setEditing({...editing, subject: e.target.value})}
                className="input w-full" />
              <input placeholder="Obor (volitelné)" value={editing.category || ''}
                onChange={e => setEditing({...editing, category: e.target.value})}
                className="input w-full" />
              <textarea value={editing.body_html}
                onChange={e => setEditing({...editing, body_html: e.target.value})}
                className="input w-full font-mono h-64" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="btn-secondary">Zrušit</button>
                <button onClick={handleSave} className="btn-primary">Uložit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPreview(null)}>
          <div className="bg-surface2 rounded-2xl border border-border-light p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text mb-2">Náhled emailu</h2>
            <div className="text-sm font-medium text-text mb-4">Předmět: {preview.subject}</div>
            <div className="border border-border-light rounded-lg p-4 whitespace-pre-wrap text-sm bg-surface">
              {preview.body}
            </div>
            <button onClick={() => setPreview(null)} className="btn-secondary mt-4">Zavřít</button>
          </div>
        </div>
      )}

      {/* AI Generate modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAiModal(false)}>
          <div className="bg-surface2 rounded-2xl border border-border-light p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-primary-light" /> AI Email Generátor
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Claude AI napíše personalizovaný email na základě dat kontaktu (score, problémy, CMS...).
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">ID kontaktu:</label>
                <input type="number" placeholder="Např. 1" value={aiContactId}
                  onChange={e => setAiContactId(e.target.value)}
                  className="input w-full" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAiModal(false)} className="btn-secondary">Zrušit</button>
                <button onClick={handleAiGenerate} disabled={!aiContactId || aiGenerating}
                  className="btn-primary flex items-center gap-1.5">
                  {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {aiGenerating ? 'Generuji...' : 'Generovat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
