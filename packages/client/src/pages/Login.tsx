import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vyplňte email a heslo');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Přihlášení se nezdařilo');
        setLoading(false);
        return;
      }

      localStorage.setItem('zenuly_auth', JSON.stringify({
        token: data.token,
        user: data.user,
      }));

      navigate('/admin');
    } catch (err: any) {
      setError('Chyba připojení k serveru');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-page">
        <div className="bg-surface2 rounded-2xl border border-border-light p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white font-bold text-lg">Z</span>
            </div>
            <div>
              <h1 className="font-display text-xl text-text">Zenuly CRM</h1>
              <p className="text-xs text-text-dim font-mono uppercase tracking-wider">Přihlášení</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vas@email.cz" autoComplete="email" autoFocus
                className="input"
              />
            </div>

            <div>
              <label className="label">Heslo</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Zadejte heslo"
                  autoComplete="current-password"
                  className="input pr-11"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={16} /> Přihlásit se</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-dim mt-6 font-mono">
          &copy; {new Date().getFullYear()} Zenuly CRM
        </p>
      </div>
    </div>
  );
}
