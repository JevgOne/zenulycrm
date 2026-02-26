import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, patch } from '../api/client';

const STAGES = [
  { key: 'new', label: 'Nový', color: 'border-t-gray-400' },
  { key: 'contacted', label: 'Oslovený', color: 'border-t-blue-400' },
  { key: 'responded', label: 'Odpověděl', color: 'border-t-yellow-400' },
  { key: 'meeting', label: 'Schůzka', color: 'border-t-purple-400' },
  { key: 'client', label: 'Klient', color: 'border-t-green-400' },
  { key: 'lost', label: 'Ztracený', color: 'border-t-red-400' },
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
    <div>
      <h1 className="text-2xl font-bold mb-6">Pipeline</h1>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {grouped.map(stage => (
          <div
            key={stage.key}
            className={`flex-1 min-w-[200px] bg-gray-50 rounded-lg border-t-4 ${stage.color}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData('contactId'));
              if (id) handleDrop(id, stage.key);
            }}
          >
            <div className="p-3 border-b bg-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{stage.label}</span>
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
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
                  className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing
                    hover:shadow-sm transition-shadow ${dragging === c.id ? 'opacity-50' : ''}`}
                >
                  <Link to={`/contacts/${c.id}`} className="block">
                    <div className="font-medium text-sm truncate">
                      {c.business_name || c.domain || 'Bez názvu'}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                      {c.category && <span>{c.category}</span>}
                      {c.city && <span>{c.city}</span>}
                    </div>
                    {c.score > 0 && (
                      <div className="mt-1.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          c.score >= 50 ? 'bg-red-100 text-red-700'
                          : c.score >= 30 ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
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
