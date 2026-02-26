import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post, del } from '../api/client';
import { Plus, Search, Upload, Trash2 } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  responded: 'bg-yellow-100 text-yellow-700',
  meeting: 'bg-purple-100 text-purple-700',
  client: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>({ contacts: [], total: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const stage = searchParams.get('stage') || '';
  const category = searchParams.get('category') || '';
  const city = searchParams.get('city') || '';
  const page = Number(searchParams.get('page') || '1');

  useEffect(() => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    if (search) params.set('q', search);
    params.set('page', String(page));

    get(`/contacts?${params}`).then(setData);
  }, [stage, category, city, search, page]);

  useEffect(() => {
    get('/contacts/categories').then(setCategories);
    get('/contacts/cities').then(setCities);
  }, []);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`Smazat ${ids.length} kontaktů?`)) return;
    await post('/contacts/bulk', { ids, action: 'delete' });
    setSelected(new Set());
    get(`/contacts?${searchParams}`).then(setData);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kontakty ({data.total})</h1>
        <div className="flex gap-2">
          <Link to="/import" className="btn-secondary flex items-center gap-1.5">
            <Upload size={16} /> Import
          </Link>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Přidat kontakt
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border rounded-lg text-sm w-56"
          />
        </div>
        <select value={stage} onChange={e => setFilter('stage', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Všechny stavy</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={category} onChange={e => setFilter('category', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Všechny obory</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={city} onChange={e => setFilter('city', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Všechna města</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {selected.size > 0 && (
          <button onClick={() => handleDelete([...selected])}
            className="ml-auto text-red-600 text-sm flex items-center gap-1">
            <Trash2 size={14} /> Smazat ({selected.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 w-8">
                <input type="checkbox"
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(data.contacts.map((c: any) => c.id)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="p-3 text-left">Firma / Web</th>
              <th className="p-3 text-left">Obor</th>
              <th className="p-3 text-left">Město</th>
              <th className="p-3 text-center">Score</th>
              <th className="p-3 text-left">Stav</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Přidáno</th>
            </tr>
          </thead>
          <tbody>
            {data.contacts.map((c: any) => (
              <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(c.id)}
                    onChange={e => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                      setSelected(next);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Link to={`/contacts/${c.id}`} className="font-medium text-brand-600 hover:underline">
                    {c.business_name || c.domain || 'Bez názvu'}
                  </Link>
                  {c.domain && <div className="text-xs text-gray-400">{c.domain}</div>}
                </td>
                <td className="p-3 text-gray-600">{c.category || '-'}</td>
                <td className="p-3 text-gray-600">{c.city || '-'}</td>
                <td className="p-3 text-center">
                  <ScoreBadge score={c.score} />
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[c.stage] || ''}`}>
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                </td>
                <td className="p-3 text-gray-500 text-xs">{c.email || '-'}</td>
                <td className="p-3 text-gray-400 text-xs">
                  {new Date(c.created_at).toLocaleDateString('cs')}
                </td>
              </tr>
            ))}
            {data.contacts.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">
                Žádné kontakty. Přidej kontakt nebo importuj CSV.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p}
              onClick={() => setFilter('page', String(p))}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-brand-600 text-white' : 'border hover:bg-gray-50'}`}
            >{p}</button>
          ))}
        </div>
      )}

      {/* Add contact modal */}
      {showForm && <AddContactModal onClose={() => setShowForm(false)} onSaved={() => {
        setShowForm(false);
        get(`/contacts?${searchParams}`).then(setData);
      }} />}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-red-100 text-red-700'
    : score >= 40 ? 'bg-orange-100 text-orange-700'
    : score >= 20 ? 'bg-yellow-100 text-yellow-700'
    : 'bg-green-100 text-green-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{score}</span>;
}

function AddContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    business_name: '', url: '', email: '', phone: '',
    contact_name: '', category: '', city: '', notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = form.url ? form.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : '';
    await post('/contacts', { ...form, domain });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Přidat kontakt</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Název firmy" value={form.business_name}
              onChange={e => setForm({...form, business_name: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Web (url)" value={form.url}
              onChange={e => setForm({...form, url: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Email" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Telefon" value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Kontaktní osoba" value={form.contact_name}
              onChange={e => setForm({...form, contact_name: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Obor" value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Město" value={form.city}
              onChange={e => setForm({...form, city: e.target.value})}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea placeholder="Poznámky" value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
            className="border rounded-lg px-3 py-2 text-sm w-full h-20" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Zrušit</button>
            <button type="submit" className="btn-primary">Uložit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
