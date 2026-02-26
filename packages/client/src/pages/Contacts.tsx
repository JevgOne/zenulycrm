import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/client';
import {
  Plus, Search, Upload, Trash2, Mail, Phone, MapPin,
  Building2, User, ChevronLeft, ChevronRight, Filter, X,
  Users, UserPlus, Star, Calendar, ExternalLink, MoreHorizontal,
  Tag, ChevronDown
} from 'lucide-react';

const STAGES = [
  { key: '', label: 'Vše', icon: Users },
  { key: 'new', label: 'Nové', color: 'bg-slate-500' },
  { key: 'contacted', label: 'Oslovené', color: 'bg-blue-500' },
  { key: 'responded', label: 'Odpověděli', color: 'bg-amber-500' },
  { key: 'meeting', label: 'Schůzka', color: 'bg-violet-500' },
  { key: 'client', label: 'Klienti', color: 'bg-emerald-500' },
  { key: 'lost', label: 'Ztracené', color: 'bg-red-400' },
];

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

const STAGE_DOT: Record<string, string> = {
  new: 'bg-slate-400', contacted: 'bg-blue-400', responded: 'bg-amber-400',
  meeting: 'bg-violet-400', client: 'bg-emerald-400', lost: 'bg-red-400',
};

function getInitials(name: string | null, business: string | null, email: string | null): string {
  const source = name || business || email || '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600', 'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600', 'from-cyan-400 to-cyan-600',
  'from-indigo-400 to-indigo-600', 'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600', 'from-orange-400 to-orange-600',
];

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>({ contacts: [], total: 0, totalPages: 0 });
  const [stageCounts, setStageCounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

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
    params.set('limit', '30');
    get(`/contacts?${params}`).then(setData);
  }, [stage, category, city, search, page]);

  useEffect(() => {
    get('/contacts/stages').then(setStageCounts);
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
    const params = new URLSearchParams(searchParams);
    get(`/contacts?${params}`).then(setData);
    get('/contacts/stages').then(setStageCounts);
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const stageCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    stageCounts.forEach((s: any) => { map[s.stage] = s.count; });
    return map;
  }, [stageCounts]);

  const totalContacts = useMemo(() =>
    stageCounts.reduce((sum: number, s: any) => sum + s.count, 0),
    [stageCounts]
  );

  const activeFilters = [category, city].filter(Boolean).length;

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
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakty</h1>
          <p className="text-sm text-gray-500 mt-1">
            Celkem <span className="font-semibold text-gray-700">{totalContacts.toLocaleString('cs')}</span> kontaktů v databázi
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/import" className="btn-secondary flex items-center gap-1.5 text-xs">
            <Upload size={14} /> Import
          </Link>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus size={14} /> Nový kontakt
          </button>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100/80 rounded-xl p-1 overflow-x-auto">
        {STAGES.map(s => {
          const count = s.key === '' ? totalContacts : (stageCountMap[s.key] || 0);
          const isActive = stage === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter('stage', s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {s.color && <span className={`w-2 h-2 rounded-full ${s.color}`} />}
              {s.icon && <s.icon size={14} />}
              {s.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200/60 text-gray-400'
              }`}>
                {count.toLocaleString('cs')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat kontakt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-sm transition-all ${
            activeFilters > 0 || showFilters
              ? 'bg-brand-50 text-brand-600 border-brand-200'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter size={14} />
          Filtry
          {activeFilters > 0 && (
            <span className="bg-brand-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>

        {selected.size > 0 && (
          <button onClick={() => handleDelete([...selected])}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 shadow-sm transition-all">
            <Trash2 size={14} /> Smazat {selected.size}
          </button>
        )}
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex gap-3 mb-4 flex-wrap bg-white rounded-xl border shadow-sm p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Kategorie</label>
            <select value={category} onChange={e => setFilter('category', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-gray-50">
              <option value="">Všechny kategorie</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Město</label>
            <select value={city} onChange={e => setFilter('city', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-gray-50">
              <option value="">Všechna města</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilter('category', ''); setFilter('city', ''); }}
              className="self-end flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium transition-colors mb-0.5"
            >
              <X size={12} /> Zrušit filtry
            </button>
          )}
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-gray-400">
          Zobrazeno {data.contacts.length} z {data.total.toLocaleString('cs')} výsledků
        </p>
        {selected.size > 0 && (
          <p className="text-xs text-brand-600 font-medium">
            Vybráno: {selected.size}
          </p>
        )}
      </div>

      {/* Contact cards */}
      <div className="space-y-2">
        {data.contacts.map((c: any) => (
          <ContactCard
            key={c.id}
            contact={c}
            isSelected={selected.has(c.id)}
            onToggleSelect={() => toggleSelect(c.id)}
          />
        ))}

        {data.contacts.length === 0 && (
          <div className="bg-white rounded-2xl border shadow-sm py-20 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <User size={28} className="text-gray-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-600">Žádné kontakty</p>
              <p className="text-sm text-gray-400 mt-1">Přidejte kontakt nebo importujte data ze souboru</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Link to="/import" className="btn-secondary flex items-center gap-1.5 text-xs">
                <Upload size={14} /> Importovat
              </Link>
              <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Nový kontakt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 mb-2">
          <p className="text-sm text-gray-500">
            Strana <span className="font-medium">{page}</span> z <span className="font-medium">{data.totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('page', String(Math.max(1, page - 1)))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((p, i) =>
              p === null ? (
                <span key={`dots-${i}`} className="px-2 text-gray-300">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setFilter('page', String(p))}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                    p === page
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-sm'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setFilter('page', String(Math.min(data.totalPages, page + 1)))}
              disabled={page === data.totalPages}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add contact modal */}
      {showForm && <AddContactModal onClose={() => setShowForm(false)} onSaved={() => {
        setShowForm(false);
        const params = new URLSearchParams(searchParams);
        get(`/contacts?${params}`).then(setData);
        get('/contacts/stages').then(setStageCounts);
      }} />}
    </div>
  );
}

/* ────────────────── Contact Card ────────────────── */

function ContactCard({ contact: c, isSelected, onToggleSelect }: {
  contact: any;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const initials = getInitials(c.contact_name, c.business_name, c.email);
  const avatarColor = AVATAR_COLORS[c.id % AVATAR_COLORS.length];
  const displayName = c.contact_name || c.business_name || c.email || 'Bez jména';
  const hasCompany = c.business_name && c.contact_name;

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all group ${
      isSelected ? 'ring-2 ring-brand-500 border-brand-300' : 'hover:border-gray-300'
    }`}>
      <div className="flex items-center gap-4 px-5 py-4">

        {/* Checkbox + Avatar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-gray-300 w-4 h-4 text-brand-600 focus:ring-brand-500/20 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
          />
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
            {initials}
          </div>
        </div>

        {/* Main info */}
        <Link to={`/contacts/${c.id}`} className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
              {displayName}
            </h3>
            {/* Stage dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[c.stage] || 'bg-gray-300'}`}
              title={STAGE_LABELS[c.stage] || c.stage} />
          </div>
          {hasCompany && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Building2 size={11} className="flex-shrink-0" />
              <span className="truncate">{c.business_name}</span>
            </p>
          )}
        </Link>

        {/* Contact details */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          {/* Email */}
          <div className="w-52">
            {c.email ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Mail size={13} className="text-blue-500" />
                </div>
                <span className="truncate text-xs">{c.email}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 pl-9">Bez emailu</span>
            )}
          </div>

          {/* Phone */}
          <div className="w-36">
            {c.phone ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Phone size={13} className="text-emerald-500" />
                </div>
                <span className="text-xs">{c.phone}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 pl-9">Bez telefonu</span>
            )}
          </div>

          {/* City */}
          <div className="w-32">
            {c.city ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <MapPin size={13} className="text-violet-500" />
                </div>
                <span className="truncate text-xs">{c.city}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300 pl-9">-</span>
            )}
          </div>

          {/* Category */}
          {c.category && (
            <span className="text-[11px] text-gray-500 bg-gray-100 rounded-lg px-2.5 py-1 font-medium truncate max-w-[120px]">
              {c.category}
            </span>
          )}

          {/* Date */}
          <div className="text-[11px] text-gray-400 w-20 text-right flex-shrink-0">
            {new Date(c.created_at).toLocaleDateString('cs', { day: 'numeric', month: 'short', year: '2-digit' })}
          </div>
        </div>

        {/* Mobile: compact info */}
        <div className="flex md:hidden items-center gap-3 flex-shrink-0">
          {c.email && (
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Mail size={13} className="text-blue-500" />
            </div>
          )}
          {c.phone && (
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Phone size={13} className="text-emerald-500" />
            </div>
          )}
        </div>

        {/* Arrow */}
        <Link to={`/contacts/${c.id}`} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
          <ExternalLink size={14} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
}

/* ────────────────── Score Badge ────────────────── */

function ScoreBadge({ score }: { score: number }) {
  if (!score) return null;
  const color = score >= 60 ? 'from-red-400 to-red-500'
    : score >= 40 ? 'from-orange-400 to-orange-500'
    : score >= 20 ? 'from-yellow-400 to-yellow-500'
    : 'from-green-400 to-green-500';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${color} text-white text-xs font-bold shadow-sm`}>
      {score}
    </span>
  );
}

/* ────────────────── Add Contact Modal ────────────────── */

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

  const inputClass = "border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-gray-400 bg-gray-50/50";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nový kontakt</h2>
              <p className="text-xs text-gray-500">Vyplňte údaje kontaktu</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Jméno</label>
                <input placeholder="Jan Novák" value={form.contact_name}
                  onChange={e => setForm({...form, contact_name: e.target.value})}
                  className={inputClass + ' w-full'} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Firma</label>
                <input placeholder="Název firmy" value={form.business_name}
                  onChange={e => setForm({...form, business_name: e.target.value})}
                  className={inputClass + ' w-full'} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Email</label>
              <input placeholder="jan@firma.cz" type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className={inputClass + ' w-full'} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Telefon</label>
              <input placeholder="+420 ..." value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className={inputClass + ' w-full'} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Web</label>
              <input placeholder="www.firma.cz" value={form.url}
                onChange={e => setForm({...form, url: e.target.value})}
                className={inputClass + ' w-full'} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Kategorie</label>
              <input placeholder="Obor" value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
                className={inputClass + ' w-full'} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Město</label>
              <input placeholder="Praha" value={form.city}
                onChange={e => setForm({...form, city: e.target.value})}
                className={inputClass + ' w-full'} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Poznámky</label>
            <textarea placeholder="Volitelné poznámky..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className={`${inputClass} w-full h-20 resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Zrušit</button>
            <button type="submit" className="btn-primary">Uložit kontakt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
