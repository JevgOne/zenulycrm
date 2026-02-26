import { useEffect, useState } from 'react';
import { get, post, del } from '../api/client';
import { Plus, Trash2, Play, Users, Pause } from 'lucide-react';

export default function Sequences() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEnroll, setShowEnroll] = useState<number | null>(null);

  useEffect(() => {
    get('/sequences').then(setSequences);
    get('/templates').then(setTemplates);
  }, []);

  const reload = () => get('/sequences').then(setSequences);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Follow-up sekvence</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Nová sekvence
        </button>
      </div>

      <div className="space-y-3">
        {sequences.map(s => (
          <div key={s.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {s.name}
                  {s.is_active ?
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Aktivní</span>
                    : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Pozastaveno</span>
                  }
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {s.step_count} kroků | {s.active_enrollments} aktivních | {s.completed_enrollments} dokončených
                </div>
                {s.description && <div className="text-sm text-gray-400 mt-1">{s.description}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEnroll(s.id)}
                  className="btn-secondary text-sm flex items-center gap-1">
                  <Users size={14} /> Přidat kontakty
                </button>
                <button onClick={async () => { await del(`/sequences/${s.id}`); reload(); }}
                  className="text-red-400 hover:text-red-600 p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {sequences.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p className="mb-2">Žádné sekvence.</p>
            <p className="text-sm">Sekvence automaticky posílají follow-up emaily v nastavených intervalech.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSequenceModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload(); }}
        />
      )}

      {showEnroll && (
        <EnrollModal
          sequenceId={showEnroll}
          onClose={() => setShowEnroll(null)}
          onEnrolled={() => { setShowEnroll(null); reload(); }}
        />
      )}
    </div>
  );
}

function CreateSequenceModal({ templates, onClose, onCreated }: {
  templates: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([
    { template_id: '', delay_days: 0 },
    { template_id: '', delay_days: 3 },
    { template_id: '', delay_days: 7 },
  ]);

  const addStep = () => setSteps([...steps, { template_id: '', delay_days: 3 }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    const validSteps = steps.filter(s => s.template_id);
    await post('/sequences', { name, description, steps: validSteps });
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Nová follow-up sekvence</h2>
        <div className="space-y-3">
          <input placeholder="Název sekvence (např. 'Zubaři Praha')" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Popis (volitelné)" value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />

          <div className="border-t pt-3">
            <h3 className="font-medium text-sm mb-2">Kroky sekvence:</h3>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <span className="text-xs text-gray-400 w-16 shrink-0">
                  {i === 0 ? 'Ihned' : `+${step.delay_days} dní`}
                </span>
                <select value={step.template_id}
                  onChange={e => {
                    const next = [...steps];
                    next[i] = { ...next[i], template_id: e.target.value };
                    setSteps(next);
                  }}
                  className="flex-1 border rounded px-2 py-1.5 text-sm">
                  <option value="">Vybrat šablonu...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {i > 0 && (
                  <input type="number" value={step.delay_days} min={1}
                    onChange={e => {
                      const next = [...steps];
                      next[i] = { ...next[i], delay_days: Number(e.target.value) };
                      setSteps(next);
                    }}
                    className="w-16 border rounded px-2 py-1.5 text-sm text-center"
                    title="Dny po předchozím kroku"
                  />
                )}
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addStep} className="text-sm text-brand-600 hover:underline mt-1">
              + Přidat krok
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Zrušit</button>
            <button onClick={handleCreate} disabled={!name || steps.every(s => !s.template_id)}
              className="btn-primary">Vytvořit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnrollModal({ sequenceId, onClose, onEnrolled }: {
  sequenceId: number; onClose: () => void; onEnrolled: () => void;
}) {
  const [filter, setFilter] = useState({ stage: 'new', category: '', city: '', minScore: 0 });
  const [result, setResult] = useState<any>(null);

  const handleEnroll = async () => {
    const data = await post(`/sequences/${sequenceId}/enroll`, { filter });
    setResult(data);
    setTimeout(onEnrolled, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Přidat kontakty do sekvence</h2>
        <div className="space-y-3">
          <select value={filter.stage} onChange={e => setFilter({...filter, stage: e.target.value})}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Všechny stavy</option>
            <option value="new">Nový</option>
            <option value="contacted">Oslovený</option>
          </select>
          <input placeholder="Obor (volitelné)" value={filter.category}
            onChange={e => setFilter({...filter, category: e.target.value})}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Město (volitelné)" value={filter.city}
            onChange={e => setFilter({...filter, city: e.target.value})}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div>
            <label className="text-sm text-gray-500">Min. score:</label>
            <input type="number" value={filter.minScore}
              onChange={e => setFilter({...filter, minScore: Number(e.target.value)})}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {result ? (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm text-center">
              Přidáno {result.enrolled} z {result.total} kontaktů
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="btn-secondary">Zrušit</button>
              <button onClick={handleEnroll} className="btn-primary">Přidat</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
