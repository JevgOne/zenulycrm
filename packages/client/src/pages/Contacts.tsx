import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/client';
import {
  Plus, Search, Upload, Trash2, Mail, Phone, MapPin,
  Building2, User, ChevronLeft, ChevronRight, Filter, X,
  ArrowUpDown, Calendar
} from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600 ring-slate-200',
  contacted: 'bg-blue-50 text-blue-600 ring-blue-200',
  responded: 'bg-amber-50 text-amber-600 ring-amber-200',
  meeting: 'bg-violet-50 text-violet-600 ring-violet-200',
  client: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  lost: 'bg-red-50 text-red-500 ring-red-200',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Nízká', medium: 'Střední', high: 'Vysoká', hot: 'Hot',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  hot: 'text-red-500',
};

function getInitials(name: string | null, business: string | null, email: string | null): string {
  const source = name || business || email || '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function getAvatarColor(id: number): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-pink-500', 'bg-orange-500',
  ];
  return colors[id % colors.length];
}

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>({ contacts: [], total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

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

  const activeFilters = [stage, category, city].filter(Boolean).length;

  const allSelected = data.contacts.length > 0 && data.contacts.every((c: any) => selected.has(c.id));

  // Pagination helpers
  const pageNumbers = useMemo(() => {
    const total = data.totalPages || 0;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (page > 3) pages.push(null);
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
    if (page < total - 2) pages.push(null);
    if (total > 1) pages.push(total);
    return pages;
  }, [page, data.totalPages]);

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakty</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.total.toLocaleString('cs')} kontaktů celkem
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/import" className="btn-secondary flex items-center gap-1.5">
            <Upload size={15} /> Import
          </Link>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} /> Nový kontakt
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl border shadow-sm mb-4">
        <div className="flex items-center gap-3 p-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Hledat podle jména, emailu, firmy, města..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeFilters > 0
                ? 'bg-brand-50 text-brand-600 border-brand-200'
                : 'text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter size={15} />
            Filtry
            {activeFilters > 0 && (
              <span className="bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>

          {selected.size > 0 && (
            <button onClick={() => handleDelete([...selected])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
              <Trash2 size={14} /> Smazat ({selected.size})
            </button>
          )}
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="px-3 pb-3 flex gap-3 flex-wrap border-t pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stav</label>
              <select value={stage} onChange={e => setFilter('stage', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                <option value="">Všechny stavy</option>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Obor</label>
              <select value={category} onChange={e => setFilter('category', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                <option value="">Všechny obory</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Město</label>
              <select value={city} onChange={e => setFilter('city', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                <option value="">Všechna města</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilter('stage', ''); setFilter('category', ''); setFilter('city', ''); }}
                className="self-end flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors pb-1.5"
              >
                <X size={12} /> Zrušit filtry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/80">
              <th className="pl-4 pr-2 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(data.contacts.map((c: any) => c.id)));
                    else setSelected(new Set());
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kontakt
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kontaktní údaje
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kategorie
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Město
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stav
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Registrace
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.contacts.map((c: any) => (
              <tr key={c.id} className="hover:bg-brand-50/30 transition-colors group">
                <td className="pl-4 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={e => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                      setSelected(next);
                    }}
                    className="rounded border-gray-300"
                  />
                </td>

                {/* Contact name + company */}
                <td className="px-3 py-3">
                  <Link to={`/contacts/${c.id}`} className="flex items-center gap-3 group/link">
                    <div className={`w-9 h-9 rounded-full ${getAvatarColor(c.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {getInitials(c.contact_name, c.business_name, c.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 group-hover/link:text-brand-600 transition-colors truncate">
                        {c.contact_name || c.business_name || c.email || 'Bez jména'}
                      </div>
                      {c.business_name && c.contact_name && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 truncate">
                          <Building2 size={11} />
                          {c.business_name}
                        </div>
                      )}
                      {!c.contact_name && c.domain && (
                        <div className="text-xs text-gray-400 truncate">{c.domain}</div>
                      )}
                    </div>
                  </Link>
                </td>

                {/* Contact details: email + phone */}
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 truncate max-w-[220px]">
                        <Mail size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400 flex-shrink-0" />
                        {c.phone}
                      </div>
                    )}
                    {!c.email && !c.phone && (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </div>
                </td>

                {/* Category */}
                <td className="px-3 py-3">
                  {c.category ? (
                    <span className="inline-flex items-center text-xs text-gray-600 bg-gray-100 rounded-md px-2 py-0.5 truncate max-w-[140px]">
                      {c.category}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>

                {/* City */}
                <td className="px-3 py-3">
                  {c.city ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{c.city}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>

                {/* Score */}
                <td className="px-3 py-3 text-center">
                  <ScoreBadge score={c.score} />
                </td>

                {/* Stage */}
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${STAGE_COLORS[c.stage] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                </td>

                {/* Date */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={12} />
                    {new Date(c.created_at).toLocaleDateString('cs', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </td>
              </tr>
            ))}
            {data.contacts.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={24} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-500">Žádné kontakty</p>
                      <p className="text-sm text-gray-400 mt-0.5">Přidejte kontakt nebo importujte data</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">
            Strana {page} z {data.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('page', String(Math.max(1, page - 1)))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((p, i) =>
              p === null ? (
                <span key={`dots-${i}`} className="px-1 text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setFilter('page', String(p))}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setFilter('page', String(Math.min(data.totalPages, page + 1)))}
              disabled={page === data.totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
  if (!score) return <span className="text-xs text-gray-300">-</span>;
  const color = score >= 60 ? 'bg-red-50 text-red-600 ring-red-200'
    : score >= 40 ? 'bg-orange-50 text-orange-600 ring-orange-200'
    : score >= 20 ? 'bg-yellow-50 text-yellow-600 ring-yellow-200'
    : 'bg-green-50 text-green-600 ring-green-200';
  return <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ring-1 ring-inset ${color}`}>{score}</span>;
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

  const inputClass = "border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-gray-400";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Nový kontakt</h2>
        <p className="text-sm text-gray-500 mb-5">Vyplňte údaje nového kontaktu</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Jméno kontaktu" value={form.contact_name}
              onChange={e => setForm({...form, contact_name: e.target.value})}
              className={inputClass} />
            <input placeholder="Název firmy" value={form.business_name}
              onChange={e => setForm({...form, business_name: e.target.value})}
              className={inputClass} />
            <input placeholder="Email" type="email" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className={inputClass} />
            <input placeholder="Telefon" value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              className={inputClass} />
            <input placeholder="Web (url)" value={form.url}
              onChange={e => setForm({...form, url: e.target.value})}
              className={inputClass} />
            <input placeholder="Obor / Kategorie" value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
              className={inputClass} />
            <input placeholder="Město" value={form.city}
              onChange={e => setForm({...form, city: e.target.value})}
              className={`${inputClass} col-span-2`} />
          </div>
          <textarea placeholder="Poznámky..." value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
            className={`${inputClass} w-full h-20 resize-none`} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Zrušit</button>
            <button type="submit" className="btn-primary">Uložit kontakt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
