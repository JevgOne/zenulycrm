import { useEffect, useState } from 'react';
import { get, post, put, del } from '../api/client';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';

const DEFAULT_TEMPLATE = `Dobrý den{{kontakt ? ', ' + kontakt : ''}},

zabývám se tvorbou webových stránek a při průzkumu firem v oblasti {{obor}} v {{mesto}} jsem si všiml, že vaše stránky {{web}} mají několik nedostatků:

{{problemy}}

Vaše stránka získala skóre {{score}}/100 v našem testu zastaralosti.

Rád bych vám nabídl bezplatnou 15min konzultaci, kde vám ukážu, jak tyto problémy ovlivňují vaši viditelnost a získávání zákazníků online.

Máte zájem o krátký hovor tento týden?

S pozdravem,
{{odesilatel}}
weblyx.cz`;

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);

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

  return (
    <div className="animate-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="heading-1">Email šablony</h1>
        <button onClick={() => setEditing({
          name: '', subject: '{{firma}} - Vaše webová stránka má {{pocet_problemu}} problémů',
          body_html: DEFAULT_TEMPLATE, category: ''
        })} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Nová šablona
        </button>
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
    </div>
  );
}
