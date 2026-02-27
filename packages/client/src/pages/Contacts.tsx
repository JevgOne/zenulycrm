import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/client';
import {
  Plus, Search, Upload, Trash2, Mail, Phone, MapPin,
  Building2, User, ChevronLeft, ChevronRight, Filter, X,
  Users, UserPlus, ExternalLink, Database, Globe, FileSpreadsheet, PenLine
} from 'lucide-react';

const SOURCES = [
  { key: '', label: 'Vše', icon: Database },
  { key: 'xml_import', label: 'Import', icon: FileSpreadsheet },
  { key: 'web_scan', label: 'Web Scanner', icon: Globe },
  { key: 'manual', label: 'Manuální', icon: PenLine },
];

const STAGES = [
  { key: '', label: 'Vše', icon: Users },
  { key: 'new', label: 'Nové', color: 'bg-text-dim' },
  { key: 'contacted', label: 'Oslovené', color: 'bg-primary' },
  { key: 'responded', label: 'Odpověděli', color: 'bg-teal' },
  { key: 'meeting', label: 'Schůzka', color: 'bg-accent' },
  { key: 'client', label: 'Klienti', color: 'bg-teal' },
  { key: 'lost', label: 'Ztracené', color: 'bg-danger' },
];

const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

const STAGE_DOT: Record<string, string> = {
  new: 'bg-text-dim', contacted: 'bg-primary', responded: 'bg-teal',
  meeting: 'bg-accent', client: 'bg-teal', lost: 'bg-danger',
};

function getInitials(name: string | null, business: string | null, email: string | null): string {
  const source = name || business || email || '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'from-primary/80 to-primary', 'from-teal/80 to-teal',
  'from-accent/60 to-accent/90', 'from-danger/70 to-danger',
  'from-primary-light/70 to-primary', 'from-teal/60 to-primary',
  'from-indigo-500 to-primary', 'from-teal to-accent/70',
  'from-pink-500/80 to-primary', 'from-orange-500/70 to-danger/80',
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
  const [sourceCounts, setSourceCounts] = useState<any[]>([]);

  const stage = searchParams.get('stage') || '';
  const source = searchParams.get('source') || '';
  const category = searchParams.get('category') || '';
  const city = searchParams.get('city') || '';
  const page = Number(searchParams.get('page') || '1');

  useEffect(() => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (source) params.set('source', source);
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    if (search) params.set('q', search);
    params.set('page', String(page));
    params.set('limit', '30');
    get(`/contacts?${params}`).then(setData);
  }, [stage, source, category, city, search, page]);

  useEffect(() => {
    get('/contacts/stages').then(setStageCounts);
    get('/contacts/sources').then(setSourceCounts);
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

  const sourceCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    sourceCounts.forEach((s: any) => { map[s.source] = s.count; });
    return map;
  }, [sourceCounts]);

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
    <div className="animate-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="heading-1">Kontakty</h1>
          <p className="text-sm text-text-muted mt-1">
            Celkem <span className="font-semibold text-text">{totalContacts.toLocaleString('cs')}</span> kontaktů v databázi
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/import" className="btn-secondary flex items-center gap-1.5 text-xs">
            <Upload size={14} /> Import
          </Link>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus size={14} /> Nový kontakt
          </button>
        </div>
      </div>

      {/* Source tabs (databáze) */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {SOURCES.map(s => {
          const count = s.key === '' ? totalContacts : (sourceCountMap[s.key] || 0);
          const isActive = source === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter('source', s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-primary/12 text-primary-light border-primary/30'
                  : 'bg-transparent text-text-muted border-transparent hover:text-text hover:bg-surface2/50'
              }`}
            >
              <s.icon size={15} strokeWidth={1.5} />
              {s.label}
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-primary/15 text-primary-light' : 'bg-border/50 text-text-dim'
              }`}>
                {count.toLocaleString('cs')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1 mb-4 bg-surface rounded-xl p-1 border border-border overflow-x-auto">
        {STAGES.map(s => {
          const count = s.key === '' ? totalContacts : (stageCountMap[s.key] || 0);
          const isActive = stage === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter('stage', s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-surface2 text-text shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface2/50'
              }`}
            >
              {s.color && <span className={`w-2 h-2 rounded-full ${s.color}`} />}
              {s.icon && <s.icon size={14} />}
              {s.label}
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-border text-text-muted' : 'bg-border/50 text-text-dim'
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Hledat kontakt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
            activeFilters > 0 || showFilters
              ? 'bg-primary/10 text-primary-light border-primary/30'
              : 'bg-surface2 text-text-muted border-border-light hover:border-primary/30'
          }`}
        >
          <Filter size={14} />
          Filtry
          {activeFilters > 0 && (
            <span className="bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>

        {selected.size > 0 && (
          <button onClick={() => handleDelete([...selected])}
            className="btn-danger flex items-center gap-1.5 text-xs">
            <Trash2 size={14} /> Smazat {selected.size}
          </button>
        )}
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex gap-3 mb-4 flex-wrap card">
          <div className="flex flex-col gap-1.5">
            <label className="label">Kategorie</label>
            <select value={category} onChange={e => setFilter('category', e.target.value)}
              className="input min-w-[180px]">
              <option value="">Všechny kategorie</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Město</label>
            <select value={city} onChange={e => setFilter('city', e.target.value)}
              className="input min-w-[180px]">
              <option value="">Všechna města</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilter('category', ''); setFilter('city', ''); }}
              className="self-end flex items-center gap-1.5 text-xs text-danger hover:text-danger/80 font-medium transition-colors mb-0.5"
            >
              <X size={12} /> Zrušit filtry
            </button>
          )}
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-text-dim font-mono">
          Zobrazeno {data.contacts.length} z {data.total.toLocaleString('cs')} výsledků
        </p>
        {selected.size > 0 && (
          <p className="text-xs text-primary font-medium">
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
          <div className="card py-20 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
              <User size={28} className="text-text-dim" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-text">Žádné kontakty</p>
              <p className="text-sm text-text-muted mt-1">Přidejte kontakt nebo importujte data ze souboru</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Link to="/admin/import" className="btn-secondary flex items-center gap-1.5 text-xs">
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
          <p className="text-sm text-text-muted font-mono">
            Strana <span className="font-medium text-text">{page}</span> z <span className="font-medium text-text">{data.totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('page', String(Math.max(1, page - 1)))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-border-light bg-surface2 hover:bg-surface text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((p, i) =>
              p === null ? (
                <span key={`dots-${i}`} className="px-2 text-text-dim">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setFilter('page', String(p))}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                    p === page
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-surface2 border border-border-light hover:border-primary/30 text-text-muted'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setFilter('page', String(Math.min(data.totalPages, page + 1)))}
              disabled={page === data.totalPages}
              className="p-2 rounded-lg border border-border-light bg-surface2 hover:bg-surface text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
    <div className={`bg-surface2 rounded-xl border transition-all group ${
      isSelected ? 'ring-2 ring-primary border-primary/50' : 'border-border-light hover:border-primary/30'
    }`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-border-light w-4 h-4 text-primary focus:ring-primary/20 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity bg-surface"
          />
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
            {initials}
          </div>
        </div>

        <Link to={`/admin/contacts/${c.id}`} className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text truncate group-hover:text-primary-light transition-colors">
              {displayName}
            </h3>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[c.stage] || 'bg-text-dim'}`}
              title={STAGE_LABELS[c.stage] || c.stage} />
          </div>
          {hasCompany && (
            <p className="text-xs text-text-dim mt-0.5 flex items-center gap-1">
              <Building2 size={11} className="flex-shrink-0" />
              <span className="truncate">{c.business_name}</span>
            </p>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <div className="w-52">
            {c.email ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail size={13} className="text-primary" />
                </div>
                <span className="truncate text-xs">{c.email}</span>
              </div>
            ) : (
              <span className="text-xs text-text-dim pl-9">Bez emailu</span>
            )}
          </div>

          <div className="w-36">
            {c.phone ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <Phone size={13} className="text-teal" />
                </div>
                <span className="text-xs">{c.phone}</span>
              </div>
            ) : (
              <span className="text-xs text-text-dim pl-9">Bez telefonu</span>
            )}
          </div>

          <div className="w-32">
            {c.city ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={13} className="text-accent" />
                </div>
                <span className="truncate text-xs">{c.city}</span>
              </div>
            ) : (
              <span className="text-xs text-text-dim pl-9">-</span>
            )}
          </div>

          {c.category && (
            <span className="badge bg-border text-text-muted truncate max-w-[120px]">
              {c.category}
            </span>
          )}

          <div className="text-[11px] font-mono text-text-dim w-20 text-right flex-shrink-0">
            {new Date(c.created_at).toLocaleDateString('cs', { day: 'numeric', month: 'short', year: '2-digit' })}
          </div>
        </div>

        <div className="flex md:hidden items-center gap-3 flex-shrink-0">
          {c.email && (
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail size={13} className="text-primary" />
            </div>
          )}
          {c.phone && (
            <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
              <Phone size={13} className="text-teal" />
            </div>
          )}
        </div>

        <Link to={`/admin/contacts/${c.id}`} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface transition-colors opacity-0 group-hover:opacity-100">
          <ExternalLink size={14} className="text-text-dim" />
        </Link>
      </div>
    </div>
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface2 rounded-2xl w-full max-w-lg border border-border-light shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="heading-2">Nový kontakt</h2>
              <p className="text-xs text-text-muted">Vyplňte údaje kontaktu</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jméno</label>
              <input placeholder="Jan Novák" value={form.contact_name}
                onChange={e => setForm({...form, contact_name: e.target.value})}
                className="input" />
            </div>
            <div>
              <label className="label">Firma</label>
              <input placeholder="Název firmy" value={form.business_name}
                onChange={e => setForm({...form, business_name: e.target.value})}
                className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input placeholder="jan@firma.cz" type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="input" />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input placeholder="+420 ..." value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="input" />
            </div>
            <div>
              <label className="label">Web</label>
              <input placeholder="www.firma.cz" value={form.url}
                onChange={e => setForm({...form, url: e.target.value})}
                className="input" />
            </div>
            <div>
              <label className="label">Kategorie</label>
              <input placeholder="Obor" value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
                className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Město</label>
              <input placeholder="Praha" value={form.city}
                onChange={e => setForm({...form, city: e.target.value})}
                className="input" />
            </div>
          </div>
          <div>
            <label className="label">Poznámky</label>
            <textarea placeholder="Volitelné poznámky..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="input h-20 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Zrušit</button>
            <button type="submit" className="btn-primary">Uložit kontakt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
