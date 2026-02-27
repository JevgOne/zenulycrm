import { useState, useRef } from 'react';
import { post, get } from '../api/client';
import { Upload, Search, Loader2, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  'zubní ordinace', 'kadeřnictví', 'květinářství', 'kosmetický salon',
  'veterinář', 'fyzioterapie', 'autoservis', 'účetnictví',
  'instalatér', 'elektrikář', 'autoškola', 'jazyková škola',
  'cukrárna', 'pekárna', 'vinotéka',
];

const CITIES = [
  'Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec',
  'Olomouc', 'České Budějovice', 'Hradec Králové',
  'Ústí nad Labem', 'Pardubice', 'Zlín', 'Kladno',
];

export default function Import() {
  return (
    <div className="animate-page">
      <h1 className="heading-1 mb-6">Import / Scanner</h1>
      <div className="grid grid-cols-2 gap-6">
        <CsvImport />
        <WebScanner />
        <ManualBulk />
      </div>
    </div>
  );
}

function CsvImport() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/import/csv', { method: 'POST', body: formData });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="card">
      <h2 className="heading-2 mb-3 flex items-center gap-2">
        <Upload size={18} /> Import CSV
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Nahraj CSV soubor z lead-finderu nebo vlastní seznam kontaktů.
      </p>

      <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
      <button onClick={() => fileRef.current?.click()} disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Importuji...</>
          : <><Upload size={16} /> Vybrat CSV soubor</>}
      </button>

      {result && (
        <div className="mt-4 p-3 bg-teal/10 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-teal font-medium">
            <CheckCircle size={16} /> Import dokončen
          </div>
          <div className="mt-1 text-teal">
            Nových: {result.imported} | Aktualizovaných: {result.updated} | Přeskočeno: {result.skipped}
          </div>
        </div>
      )}
    </div>
  );
}

function WebScanner() {
  const [category, setCategory] = useState('zubní ordinace');
  const [city, setCity] = useState('Praha');
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const startScan = async () => {
    const res = await post('/import/scan', { category, city });
    setJobId(res.jobId);
    setPolling(true);

    // Poll for status
    const poll = setInterval(async () => {
      const s = await get(`/import/scan/${res.jobId}`);
      setStatus(s);
      if (s.status !== 'running') {
        clearInterval(poll);
        setPolling(false);
      }
    }, 2000);
  };

  return (
    <div className="card">
      <h2 className="heading-2 mb-3 flex items-center gap-2">
        <Search size={18} /> Web Scanner
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Automaticky najdi firmy se zastaralými weby.
      </p>

      <div className="space-y-3">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="input w-full">
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={city} onChange={e => setCity(e.target.value)}
          className="input w-full">
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={startScan} disabled={polling}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {polling ? <><Loader2 size={16} className="animate-spin" /> Scanuji...</>
            : <><Search size={16} /> Spustit scan</>}
        </button>
      </div>

      {status && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          status.status === 'completed' ? 'bg-teal/10 text-teal'
          : status.status === 'error' ? 'bg-danger/10 text-danger'
          : 'bg-primary/10 text-primary-light'
        }`}>
          <div className="font-medium">{status.progress}</div>
          {status.result && (
            <div className="mt-1">Importováno: {status.result.imported} z {status.result.total}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualBulk() {
  const [emails, setEmails] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [result, setResult] = useState<string>('');

  const handleImport = async () => {
    const lines = emails.split('\n').map(l => l.trim()).filter(Boolean);
    let count = 0;
    for (const line of lines) {
      // Parse: could be just email, or "name <email>", or "email, name"
      let email = line;
      let name = '';
      const match = line.match(/^(.+?)\s*[<,]\s*([^>,]+@[^>,]+)\s*>?$/);
      if (match) { name = match[1].trim(); email = match[2].trim(); }

      await post('/contacts', {
        email,
        business_name: name || undefined,
        category: category || undefined,
        city: city || undefined,
        source: 'manual',
      });
      count++;
    }
    setResult(`Přidáno ${count} kontaktů`);
    setEmails('');
  };

  return (
    <div className="card">
      <h2 className="heading-2 mb-3">Rychlý import emailů</h2>
      <p className="text-sm text-text-muted mb-4">
        Vlož emaily (jeden na řádek). Formát: email nebo "Jméno &lt;email&gt;"
      </p>

      <div className="space-y-3">
        <textarea value={emails} onChange={e => setEmails(e.target.value)}
          placeholder={"jan@firma.cz\nPetr Novák <petr@novak.cz>\ninfo@kvetiny.cz"}
          className="input w-full h-28 font-mono" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Obor (volitelné)" value={category}
            onChange={e => setCategory(e.target.value)}
            className="input" />
          <input placeholder="Město (volitelné)" value={city}
            onChange={e => setCity(e.target.value)}
            className="input" />
        </div>
        <button onClick={handleImport} disabled={!emails.trim()} className="btn-primary w-full">
          Přidat kontakty
        </button>
      </div>

      {result && (
        <div className="mt-3 p-2 bg-teal/10 text-teal rounded text-sm text-center">
          {result}
        </div>
      )}
    </div>
  );
}
