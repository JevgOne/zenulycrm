import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Key, Shield, Eye, EyeOff, Save, X, AlertTriangle } from 'lucide-react';
import { get, post, put, del } from '../api/client';
import { getUser } from '../api/client';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export default function Settings() {
  const [tab, setTab] = useState<'users' | 'api' | 'general'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [changingPassword, setChangingPassword] = useState<number | null>(null);

  const currentUser = getUser();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await get<User[]>('/users');
      setUsers(data);
    } catch {
      // handle error
    }
    setLoading(false);
  }

  const tabs = [
    { id: 'users' as const, label: 'Uživatelé', icon: Users },
    { id: 'api' as const, label: 'API Klíče', icon: Key },
    { id: 'general' as const, label: 'Obecné', icon: Shield },
  ];

  return (
    <div className="animate-page max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="heading-1">Nastavení</h1>
        <p className="text-sm text-text-muted mt-1">Správa účtů, API klíčů a nastavení systému</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-border p-1 rounded-xl mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-surface2 text-text'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="heading-2">Správa uživatelů</h2>
            <button
              onClick={() => { setShowAddUser(true); setEditingUser(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Přidat uživatele
            </button>
          </div>

          {/* Add/Edit User Form */}
          {(showAddUser || editingUser) && (
            <UserForm
              user={editingUser}
              onSave={async (data) => {
                if (editingUser) {
                  await put(`/users/${editingUser.id}`, data);
                } else {
                  await post('/users', data);
                }
                setShowAddUser(false);
                setEditingUser(null);
                loadUsers();
              }}
              onCancel={() => { setShowAddUser(false); setEditingUser(null); }}
            />
          )}

          {/* Change Password Form */}
          {changingPassword !== null && (
            <PasswordForm
              userId={changingPassword}
              onSave={async (password) => {
                await put(`/users/${changingPassword}/password`, { password });
                setChangingPassword(null);
              }}
              onCancel={() => setChangingPassword(null)}
            />
          )}

          {/* Users List */}
          {loading ? (
            <div className="text-center py-12 text-text-dim">Načítání...</div>
          ) : (
            <div className="bg-surface2 rounded-xl border border-border-light divide-y divide-border-light">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white font-semibold text-sm">
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-text flex items-center gap-2">
                        {user.name || user.email}
                        {currentUser?.email === user.email && (
                          <span className="text-[10px] bg-primary/15 text-primary-light px-1.5 py-0.5 rounded-full font-semibold">VY</span>
                        )}
                      </div>
                      <div className="text-sm text-text-muted">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      user.role === 'admin' ? 'bg-primary/15 text-primary-light' : 'bg-border text-text'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.role}
                    </span>
                    <button
                      onClick={() => setChangingPassword(user.id)}
                      className="p-2 text-text-dim hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                      title="Změnit heslo"
                    >
                      <Key size={15} />
                    </button>
                    <button
                      onClick={() => { setEditingUser(user); setShowAddUser(false); }}
                      className="p-2 text-text-dim hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Upravit"
                    >
                      <Pencil size={15} />
                    </button>
                    {currentUser?.email !== user.email && (
                      <button
                        onClick={async () => {
                          if (confirm('Opravdu chcete smazat tohoto uživatele?')) {
                            await del(`/users/${user.id}`);
                            loadUsers();
                          }
                        }}
                        className="p-2 text-text-dim hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Smazat"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="text-center py-12 text-text-dim">Žádní uživatelé</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* API Keys Tab */}
      {tab === 'api' && (
        <div className="space-y-4">
          <h2 className="heading-2">API Klíče</h2>
          <div className="bg-surface2 rounded-xl border border-border-light p-6 space-y-6">
            <ApiKeyField
              label="Resend API Key"
              description="Pro odesílání emailových kampaní"
              envKey="RESEND_API_KEY"
            />
            <ApiKeyField
              label="Turso Database URL"
              description="URL pro připojení k databázi"
              envKey="TURSO_DATABASE_URL"
            />
            <ApiKeyField
              label="Turso Auth Token"
              description="Autentizační token pro Turso"
              envKey="TURSO_AUTH_TOKEN"
            />
            <ApiKeyField
              label="Session Secret"
              description="Tajný klíč pro JWT tokeny"
              envKey="SESSION_SECRET"
            />
          </div>
          <div className="flex items-start gap-3 bg-accent/5 border border-accent/20 rounded-xl p-4">
            <AlertTriangle size={18} className="text-accent mt-0.5 shrink-0" />
            <div className="text-sm text-accent">
              <p className="font-medium">Poznámka</p>
              <p className="mt-1">API klíče jsou nastaveny jako proměnné prostředí na serveru (Vercel).
                Pro jejich změnu upravte proměnné přímo v nastavení Vercel projektu.</p>
            </div>
          </div>
        </div>
      )}

      {/* General Tab */}
      {tab === 'general' && (
        <div className="space-y-4">
          <h2 className="heading-2">Obecné nastavení</h2>
          <div className="bg-surface2 rounded-xl border border-border-light p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-text mb-1">Název CRM</h3>
              <p className="text-sm text-text-muted">Zenuly CRM</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text mb-1">Verze</h3>
              <p className="text-sm text-text-muted">1.0.0</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text mb-1">Databáze</h3>
              <p className="text-sm text-text-muted">Turso (LibSQL)</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text mb-1">Zabezpečení</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs bg-teal/15 text-teal px-2.5 py-1 rounded-full">JWT Auth</span>
                <span className="text-xs bg-teal/15 text-teal px-2.5 py-1 rounded-full">HTTPS</span>
                <span className="text-xs bg-teal/15 text-teal px-2.5 py-1 rounded-full">noindex</span>
                <span className="text-xs bg-teal/15 text-teal px-2.5 py-1 rounded-full">CORS</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function UserForm({ user, onSave, onCancel }: {
  user: User | null;
  onSave: (data: { email: string; name: string; role: string; password?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState(user?.role || 'admin');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Vyplňte email'); return; }
    if (!user && !password) { setError('Vyplňte heslo'); return; }
    setSaving(true);
    try {
      await onSave({ email, name, role, ...(password ? { password } : {}) });
    } catch (err: any) {
      setError(err.message || 'Chyba při ukládání');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface2 rounded-xl border border-border-light p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text">{user ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
        <button type="button" onClick={onCancel} className="text-text-dim hover:text-text">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="input w-full"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="label">Jméno</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="input w-full"
            placeholder="Jan Novák"
          />
        </div>
        <div>
          <label className="label">Heslo{user ? ' (nechat prázdné = beze změny)' : ''}</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              className="input w-full pr-10"
              placeholder={user ? '••••••' : 'Min. 6 znaků'}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="input w-full">
            <option value="admin">Admin</option>
            <option value="user">Uživatel</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-text hover:bg-surface rounded-lg transition-colors">
          Zrušit
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
          <Save size={14} /> {saving ? 'Ukládání...' : 'Uložit'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ userId, onSave, onCancel }: {
  userId: number;
  onSave: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Heslo musí mít alespoň 6 znaků'); return; }
    setSaving(true);
    try {
      await onSave(password);
    } catch (err: any) {
      setError(err.message || 'Chyba');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface2 rounded-xl border border-accent/20 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text">Změnit heslo</h3>
        <button type="button" onClick={onCancel} className="text-text-dim hover:text-text">
          <X size={18} />
        </button>
      </div>
      <div className="relative max-w-sm">
        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
          className="input w-full pr-10"
          placeholder="Nové heslo (min. 6 znaků)" autoFocus
        />
        <button type="button" onClick={() => setShowPw(!showPw)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text">
          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-60 transition-colors">
          <Key size={14} /> {saving ? 'Ukládání...' : 'Změnit heslo'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-text hover:bg-surface rounded-lg transition-colors">
          Zrušit
        </button>
      </div>
    </form>
  );
}

function ApiKeyField({ label, description, envKey }: {
  label: string;
  description: string;
  envKey: string;
}) {
  return (
    <div className="flex items-start justify-between pb-4 border-b border-border-light last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold text-text">{label}</h3>
        <p className="text-xs text-text-dim mt-0.5">{description}</p>
      </div>
      <code className="text-xs bg-border text-text-muted px-3 py-1.5 rounded-lg">{envKey}</code>
    </div>
  );
}
