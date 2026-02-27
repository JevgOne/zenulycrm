import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, put, post, del, patch } from '../api/client';
import {
  Globe, Mail, Phone, MapPin, Tag, Clock, ArrowLeft,
  Trash2, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';

const STAGES = ['new', 'contacted', 'responded', 'meeting', 'client', 'lost'];
const STAGE_LABELS: Record<string, string> = {
  new: 'Nový', contacted: 'Oslovený', responded: 'Odpověděl',
  meeting: 'Schůzka', client: 'Klient', lost: 'Ztracený',
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<any>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    get(`/contacts/${id}`).then(c => { setContact(c); setForm(c); });
  }, [id]);

  if (!contact) return <div className="animate-pulse">Načítám...</div>;

  const changeStage = async (stage: string) => {
    const updated = await patch(`/contacts/${id}/stage`, { stage });
    setContact({ ...contact, ...updated, activities: contact.activities });
    get(`/contacts/${id}`).then(setContact);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await post(`/contacts/${id}/notes`, { text: note });
    setNote('');
    get(`/contacts/${id}`).then(setContact);
  };

  const saveEdit = async () => {
    const updated = await put(`/contacts/${id}`, form);
    setContact({ ...contact, ...updated });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Opravdu smazat tento kontakt?')) return;
    await del(`/contacts/${id}`);
    navigate('/contacts');
  };

  const outdatedTech = (() => {
    try { return JSON.parse(contact.outdated_tech || '[]'); } catch { return []; }
  })();

  return (
    <div className="animate-page">
      <button onClick={() => navigate('/contacts')} className="text-sm text-text-muted hover:text-text mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Zpět na kontakty
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* Main info */}
        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="heading-1">{contact.business_name || contact.domain || 'Bez názvu'}</h1>
                {contact.domain && (
                  <a href={contact.url || `https://${contact.domain}`} target="_blank"
                    className="text-sm text-primary hover:underline flex items-center gap-1">
                    <Globe size={14} /> {contact.domain}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(!editing)} className="btn-secondary text-sm">
                  {editing ? 'Zrušit' : 'Upravit'}
                </button>
                <button onClick={handleDelete} className="text-danger hover:text-danger p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Název firmy" value={form.business_name || ''}
                  onChange={e => setForm({...form, business_name: e.target.value})}
                  className="input" />
                <input placeholder="Web" value={form.url || ''}
                  onChange={e => setForm({...form, url: e.target.value})}
                  className="input" />
                <input placeholder="Email" value={form.email || ''}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="input" />
                <input placeholder="Telefon" value={form.phone || ''}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  className="input" />
                <input placeholder="Kontaktní osoba" value={form.contact_name || ''}
                  onChange={e => setForm({...form, contact_name: e.target.value})}
                  className="input" />
                <input placeholder="Obor" value={form.category || ''}
                  onChange={e => setForm({...form, category: e.target.value})}
                  className="input" />
                <input placeholder="Město" value={form.city || ''}
                  onChange={e => setForm({...form, city: e.target.value})}
                  className="input" />
                <button onClick={saveEdit} className="btn-primary col-span-2">Uložit</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                {contact.email && <div className="flex items-center gap-2"><Mail size={14} className="text-text-dim" /> {contact.email}</div>}
                {contact.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-text-dim" /> {contact.phone}</div>}
                {contact.city && <div className="flex items-center gap-2"><MapPin size={14} className="text-text-dim" /> {contact.city}</div>}
                {contact.category && <div className="flex items-center gap-2"><Tag size={14} className="text-text-dim" /> {contact.category}</div>}
                {contact.contact_name && <div>Kontakt: {contact.contact_name}</div>}
                <div>Zdroj: {contact.source}</div>
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="card">
            <h2 className="heading-2 mb-3">Pipeline</h2>
            <div className="flex gap-1">
              {STAGES.map(s => (
                <button key={s} onClick={() => changeStage(s)}
                  className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                    contact.stage === s
                      ? 'bg-primary text-white'
                      : 'bg-border text-text-muted hover:bg-surface2'
                  }`}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Website analysis */}
          {contact.score > 0 && (
            <div className="card">
              <h2 className="heading-2 mb-3">Analýza webu</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <AnalysisItem
                  label="Score"
                  value={`${contact.score}/100`}
                  bad={contact.score >= 40}
                />
                <AnalysisItem
                  label="Mobilní"
                  value={contact.mobile_friendly ? 'Ano' : 'Ne'}
                  bad={!contact.mobile_friendly}
                />
                <AnalysisItem
                  label="SSL"
                  value={contact.ssl_valid ? 'OK' : 'Chybí'}
                  bad={!contact.ssl_valid}
                />
                {contact.load_time && (
                  <AnalysisItem
                    label="Rychlost"
                    value={`${contact.load_time}s`}
                    bad={contact.load_time > 3}
                  />
                )}
                {contact.copyright_year && (
                  <AnalysisItem
                    label="Copyright"
                    value={`© ${contact.copyright_year}`}
                    bad={contact.copyright_year < 2024}
                  />
                )}
                {contact.cms && (
                  <AnalysisItem label="CMS" value={contact.cms} bad={false} />
                )}
              </div>
              {outdatedTech.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Nalezené problémy:</h3>
                  <ul className="space-y-1">
                    {outdatedTech.map((t: string, i: number) => (
                      <li key={i} className="text-sm flex items-center gap-2 text-accent">
                        <AlertTriangle size={14} /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Add note */}
          <div className="card">
            <h2 className="heading-2 mb-3">Přidat poznámku</h2>
            <div className="flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="Napsat poznámku..."
                className="input flex-1"
                onKeyDown={e => e.key === 'Enter' && addNote()}
              />
              <button onClick={addNote} className="btn-primary">Přidat</button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="card h-fit">
          <h2 className="heading-2 mb-3">Historie</h2>
          <div className="space-y-3">
            {(contact.activities || []).map((a: any) => (
              <div key={a.id} className="border-l-2 border-border-light pl-3 py-1">
                <div className="text-sm font-medium">{a.title}</div>
                {a.details && a.type === 'note' && (
                  <div className="text-sm text-text mt-0.5">{a.details}</div>
                )}
                <div className="text-xs text-text-dim mt-0.5">
                  <Clock size={10} className="inline mr-1" />
                  {new Date(a.created_at).toLocaleString('cs')}
                </div>
              </div>
            ))}
            {(contact.activities || []).length === 0 && (
              <p className="text-sm text-text-dim">Žádná historie</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisItem({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${bad ? 'bg-danger/10' : 'bg-teal/10'}`}>
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`font-bold flex items-center gap-1 ${bad ? 'text-danger' : 'text-teal'}`}>
        {bad ? <XCircle size={14} /> : <CheckCircle size={14} />}
        {value}
      </div>
    </div>
  );
}
