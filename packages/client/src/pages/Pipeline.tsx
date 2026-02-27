import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, patch } from '../api/client';

const STAGES = [
  { key: 'new', label: 'Nový', color: 'border-t-text-dim/50' },
  { key: 'contacted', label: 'Oslovený', color: 'border-t-primary' },
  { key: 'responded', label: 'Odpověděl', color: 'border-t-teal' },
  { key: 'meeting', label: 'Schůzka', color: 'border-t-accent' },
  { key: 'client', label: 'Klient', color: 'border-t-teal' },
  { key: 'lost', label: 'Ztracený', color: 'border-t-danger' },
];

export default function Pipeline() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    get('/contacts?limit=500').then(d => setContacts(d.contacts));
  }, []);

  const grouped = STAGES.map(s => ({
    ...s,
    contacts: contacts.filter(c => c.stage === s.key)
  }));

  const handleDrop = async (contactId: number, newStage: string) => {
    // Optimistic update
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, stage: newStage } : c));
    await patch(`/contacts/${contactId}/stage`, { stage: newStage });
    setDragging(null);
  };

  return (
    <div className="animate-page">
      <h1 className="heading-1 mb-6">Pipeline</h1>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {grouped.map(stage => (
          <div
            key={stage.key}
            className={`flex-1 min-w-[200px] bg-surface rounded-lg border-t-4 ${stage.color}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData('contactId'));
              if (id) handleDrop(id, stage.key);
            }}
          >
            <div className="p-3 border-b border-border bg-surface2 rounded-t-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-text">{stage.label}</span>
                <span className="text-xs bg-border px-2 py-0.5 rounded-full text-text-muted">
                  {stage.contacts.length}
                </span>
              </div>
            </div>
            <div className="p-2 space-y-2 max-h-[65vh] overflow-y-auto">
              {stage.contacts.map(c => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('contactId', String(c.id));
                    setDragging(c.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className={`bg-surface2 rounded-lg border border-border-light p-3 cursor-grab active:cursor-grabbing
                    hover:border-primary/30 transition-colors ${dragging === c.id ? 'opacity-50' : ''}`}
                >
                  <Link to={`/contacts/${c.id}`} className="block">
                    <div className="font-medium text-sm truncate text-text">
                      {c.business_name || c.domain || 'Bez názvu'}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-text-dim">
                      {c.category && <span>{c.category}</span>}
                      {c.city && <span>{c.city}</span>}
                    </div>
                    {c.score > 0 && (
                      <div className="mt-1.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          c.score >= 50 ? 'bg-danger/10 text-danger'
                          : c.score >= 30 ? 'bg-accent/10 text-accent'
                          : 'bg-teal/10 text-teal'
                        }`}>
                          {c.score}
                        </span>
                      </div>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
