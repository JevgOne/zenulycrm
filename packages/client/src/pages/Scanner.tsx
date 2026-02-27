import { useState } from 'react';
import { post } from '../api/client';
import {
  Radar, Search, Globe, Plus, CheckCircle, AlertTriangle, XCircle,
  Shield, Smartphone, Clock, Calendar, Code, Mail, Phone,
  ExternalLink, Save, Loader2, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

interface ScanResult {
  url: string;
  domain?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  all_emails?: string[];
  all_phones?: string[];
  title?: string;
  description?: string;
  cms?: string;
  cms_version?: string;
  copyright_year?: number | null;
  ssl_valid?: boolean;
  mobile_friendly?: boolean;
  load_time?: number;
  outdated_tech?: string[];
  score?: number;
  error?: string;
  saved?: boolean;
  saving?: boolean;
}

function ScoreIndicator({ score }: { score: number }) {
  let color = 'text-text-dim';
  let bg = 'bg-text-dim/10';
  let label = 'Nízké';
  if (score >= 60) { color = 'text-accent'; bg = 'bg-accent/10'; label = 'Vysoké'; }
  else if (score >= 30) { color = 'text-primary-light'; bg = 'bg-primary/10'; label = 'Střední'; }
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg}`}>
      <span className={`text-lg font-bold font-mono ${color}`}>{score}</span>
      <span className={`text-xs ${color}`}>{label}</span>
    </div>
  );
}

function TechBadge({ issue }: { issue: string }) {
  return (
    <span className="badge bg-danger/10 text-danger">
      <AlertTriangle size={10} />
      {issue}
    </span>
  );
}

function ResultCard({ result, onSave, onRemove }: {
  result: ScanResult;
  onSave: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (result.error) {
    return (
      <div className="card flex items-center gap-4 opacity-60">
        <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
          <XCircle size={18} className="text-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{result.url}</p>
          <p className="text-xs text-danger mt-0.5">{result.error}</p>
        </div>
        <button onClick={onRemove} className="p-2 rounded-lg hover:bg-surface transition-colors">
          <Trash2 size={14} className="text-text-dim" />
        </button>
      </div>
    );
  }

  return (
    <div className={`card-hover ${result.saved ? 'ring-1 ring-teal/30' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Score */}
        <div className="flex-shrink-0">
          <ScoreIndicator score={result.score || 0} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-text truncate">{result.business_name || result.domain}</h3>
            {result.cms && (
              <span className="badge bg-border text-text-muted">
                <Code size={10} />
                {result.cms} {result.cms_version}
              </span>
            )}
          </div>

          <a href={result.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-text-dim hover:text-primary-light transition-colors flex items-center gap-1 mb-2">
            <Globe size={11} />
            {result.domain}
            <ExternalLink size={10} />
          </a>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mb-2">
            {result.email && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                  <Mail size={10} className="text-primary" />
                </div>
                {result.email}
              </span>
            )}
            {result.phone && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-5 h-5 rounded bg-teal/10 flex items-center justify-center">
                  <Phone size={10} className="text-teal" />
                </div>
                {result.phone}
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs ${result.ssl_valid ? 'text-teal' : 'text-danger'}`}>
              <Shield size={12} />
              {result.ssl_valid ? 'SSL' : 'Bez SSL'}
            </span>
            <span className={`flex items-center gap-1 text-xs ${result.mobile_friendly ? 'text-teal' : 'text-danger'}`}>
              <Smartphone size={12} />
              {result.mobile_friendly ? 'Mobilní' : 'Není mobilní'}
            </span>
            <span className={`flex items-center gap-1 text-xs ${
              (result.load_time || 0) > 3 ? 'text-danger' : 'text-text-muted'
            }`}>
              <Clock size={12} />
              {result.load_time}s
            </span>
            {result.copyright_year && (
              <span className={`flex items-center gap-1 text-xs ${
                result.copyright_year < new Date().getFullYear() - 1 ? 'text-danger' : 'text-text-muted'
              }`}>
                <Calendar size={12} />
                © {result.copyright_year}
              </span>
            )}
          </div>

          {/* Outdated tech */}
          {result.outdated_tech && result.outdated_tech.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {result.outdated_tech.map(t => <TechBadge key={t} issue={t} />)}
            </div>
          )}

          {/* Expandable details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {result.description && (
                <p className="text-xs text-text-muted">{result.description}</p>
              )}
              {result.all_emails && result.all_emails.length > 1 && (
                <div>
                  <span className="label">Všechny emaily</span>
                  <p className="text-xs text-text-muted">{result.all_emails.join(', ')}</p>
                </div>
              )}
              {result.all_phones && result.all_phones.length > 1 && (
                <div>
                  <span className="label">Všechna čísla</span>
                  <p className="text-xs text-text-muted">{result.all_phones.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {result.saved ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal/10 text-teal text-xs font-medium">
              <CheckCircle size={14} />
              Uloženo
            </div>
          ) : result.saving ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary-light text-xs font-medium">
              <Loader2 size={14} className="animate-spin" />
              Ukládám...
            </div>
          ) : (
            <button onClick={onSave} className="btn-primary flex items-center gap-1.5 text-xs">
              <Save size={14} />
              Uložit
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-ghost flex items-center gap-1 text-xs justify-center"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Méně' : 'Více'}
          </button>
          <button onClick={onRemove} className="p-2 rounded-lg hover:bg-surface transition-colors self-center">
            <Trash2 size={14} className="text-text-dim" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Scanner() {
  const [mode, setMode] = useState<'url' | 'search'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleScanUrls = async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);
    if (urls.length === 0) return;

    setScanning(true);
    try {
      if (urls.length === 1) {
        const result = await post('/scanner/analyze', { url: urls[0] });
        setResults(prev => [result, ...prev]);
      } else {
        const data = await post('/scanner/bulk-analyze', { urls });
        setResults(prev => [...data, ...prev]);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
    }
    setScanning(false);
    setUrlInput('');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await post('/scanner/search', { query: searchQuery, city: searchCity });
      setSearchResults(data.results || []);
      if (data.message) {
        // Show message about missing API key
        setSearchResults([{ _message: data.message }]);
      }
    } catch (err: any) {
      console.error('Search error:', err);
    }
    setSearching(false);
  };

  const handleScanSearchResult = async (url: string) => {
    setScanning(true);
    try {
      const result = await post('/scanner/analyze', { url });
      setResults(prev => [result, ...prev]);
    } catch (err: any) {
      console.error('Scan error:', err);
    }
    setScanning(false);
  };

  const handleSave = async (index: number) => {
    const r = results[index];
    if (r.saved || r.saving || r.error) return;

    setResults(prev => prev.map((item, i) => i === index ? { ...item, saving: true } : item));

    try {
      await post('/scanner/save', {
        business_name: r.business_name,
        url: r.url,
        domain: r.domain,
        email: r.email,
        phone: r.phone,
        cms: r.cms,
        cms_version: r.cms_version,
        copyright_year: r.copyright_year,
        ssl_valid: r.ssl_valid,
        mobile_friendly: r.mobile_friendly,
        load_time: r.load_time,
        outdated_tech: r.outdated_tech,
        score: r.score,
      });
      setResults(prev => prev.map((item, i) => i === index ? { ...item, saved: true, saving: false } : item));
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Chyba při ukládání';
      alert(msg);
      setResults(prev => prev.map((item, i) => i === index ? { ...item, saving: false } : item));
    }
  };

  const handleRemove = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    const unsaved = results.filter(r => !r.saved && !r.error);
    for (let i = 0; i < results.length; i++) {
      if (!results[i].saved && !results[i].error) {
        await handleSave(i);
      }
    }
  };

  const savedCount = results.filter(r => r.saved).length;
  const unsavedCount = results.filter(r => !r.saved && !r.error).length;

  return (
    <div className="animate-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="heading-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center">
              <Radar size={20} className="text-white" />
            </div>
            Web Scanner
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Analyzujte weby a najděte potenciální klienty se zastaralými technologiemi
          </p>
        </div>
        {unsavedCount > 0 && (
          <button onClick={handleSaveAll} className="btn-accent flex items-center gap-1.5">
            <Save size={14} />
            Uložit vše ({unsavedCount})
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setMode('url')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'url'
              ? 'bg-primary/12 text-primary-light'
              : 'text-text-muted hover:text-text hover:bg-surface2'
          }`}
        >
          <Globe size={15} />
          Skenovat URL
        </button>
        <button
          onClick={() => setMode('search')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'search'
              ? 'bg-primary/12 text-primary-light'
              : 'text-text-muted hover:text-text hover:bg-surface2'
          }`}
        >
          <Search size={15} />
          Vyhledat firmy
        </button>
      </div>

      {/* URL scan mode */}
      {mode === 'url' && (
        <div className="card mb-6">
          <label className="label">URL adresy (jedna na řádek)</label>
          <textarea
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder={`Zadejte URL adresy k analýze...\n\nNapř.:\nwww.restaurace-praha.cz\nautoservis-brno.cz\nhotel-ostrava.cz`}
            className="input h-32 resize-none font-mono text-xs mb-4"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleScanUrls}
              disabled={scanning || !urlInput.trim()}
              className="btn-primary flex items-center gap-1.5"
            >
              {scanning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Skenuji...
                </>
              ) : (
                <>
                  <Radar size={14} />
                  Spustit sken
                </>
              )}
            </button>
            <p className="text-xs text-text-dim">
              Max 20 URL najednou. Každý web se analyzuje na SSL, CMS, rychlost, copyright rok a zastaralé technologie.
            </p>
          </div>
        </div>
      )}

      {/* Search mode */}
      {mode === 'search' && (
        <div className="card mb-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Co hledáte?</label>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="restaurace, autoservis, e-shop..."
                className="input"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <label className="label">Město (volitelné)</label>
              <input
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                placeholder="Praha, Brno, Ostrava..."
                className="input"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="btn-primary flex items-center gap-1.5"
          >
            {searching ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Hledám...
              </>
            ) : (
              <>
                <Search size={14} />
                Vyhledat
              </>
            )}
          </button>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <label className="label">Výsledky vyhledávání</label>
              {searchResults.map((r: any, i) =>
                r._message ? (
                  <div key={i} className="card bg-surface">
                    <p className="text-sm text-text-muted">{r._message}</p>
                    <p className="text-xs text-text-dim mt-2">
                      Tip: Nastavte GOOGLE_API_KEY a GOOGLE_CX v prostředí serveru pro automatické vyhledávání.
                      Prozatím můžete zadat URL ručně v záložce "Skenovat URL".
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{r.title}</p>
                      <p className="text-xs text-text-dim truncate">{r.domain}</p>
                      {r.snippet && <p className="text-xs text-text-muted mt-1 line-clamp-2">{r.snippet}</p>}
                    </div>
                    <button
                      onClick={() => handleScanSearchResult(r.url)}
                      disabled={scanning}
                      className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
                    >
                      <Radar size={12} />
                      Skenovat
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-4 mb-4 px-1">
          <p className="text-xs text-text-dim font-mono">
            Výsledky: <span className="text-text">{results.length}</span>
          </p>
          {savedCount > 0 && (
            <p className="text-xs text-teal font-mono flex items-center gap-1">
              <CheckCircle size={11} />
              Uloženo: {savedCount}
            </p>
          )}
          {unsavedCount > 0 && (
            <p className="text-xs text-primary-light font-mono">
              K uložení: {unsavedCount}
            </p>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setResults([])}
            className="text-xs text-text-dim hover:text-danger transition-colors"
          >
            Vyčistit vše
          </button>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-3">
        {results.map((r, i) => (
          <ResultCard
            key={`${r.url}-${i}`}
            result={r}
            onSave={() => handleSave(i)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>

      {/* Empty state */}
      {results.length === 0 && !scanning && (
        <div className="card py-16 flex flex-col items-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-teal/20 flex items-center justify-center">
            <Radar size={32} className="text-primary-light" />
          </div>
          <div className="text-center max-w-md">
            <p className="font-semibold text-text">Začněte skenovat</p>
            <p className="text-sm text-text-muted mt-1">
              Zadejte URL adresy webů k analýze. Scanner zjistí kontaktní údaje,
              použitý CMS, SSL certifikát, rychlost načítání a zastaralé technologie.
            </p>
            <p className="text-xs text-text-dim mt-3">
              Weby s vyšším skóre = větší šance na prodej webové služby
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
