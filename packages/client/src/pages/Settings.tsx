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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>
        <p className="text-sm text-gray-500 mt-1">Správa účtů, API klíčů a nastavení systému</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
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
            <h2 className="text-lg font-semibold text-gray-900">Správa uživatelů</h2>
            <button
              onClick={() => { setShowAddUser(true); setEditingUser(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
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
            <div className="text-center py-12 text-gray-400">Načítání...</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-semibold text-sm">
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {user.name || user.email}
                        {currentUser?.email === user.email && (
                          <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">VY</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      user.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.role}
                    </span>
                    <button
                      onClick={() => setChangingPassword(user.id)}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Změnit heslo"
                    >
                      <Key size={15} />
                    </button>
                    <button
                      onClick={() => { setEditingUser(user); setShowAddUser(false); }}
                      className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
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
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Smazat"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="text-center py-12 text-gray-400">Žádní uživatelé</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* API Keys Tab */}
      {tab === 'api' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">API Klíče</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
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
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
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
          <h2 className="text-lg font-semibold text-gray-900">Obecné nastavení</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Název CRM</h3>
              <p className="text-sm text-gray-500">Zenuly CRM</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Verze</h3>
              <p className="text-sm text-gray-500">1.0.0</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Databáze</h3>
              <p className="text-sm text-gray-500">Turso (LibSQL)</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Zabezpečení</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">JWT Auth</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">HTTPS</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">noindex</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">CORS</span>
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{user ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Jméno</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            placeholder="Jan Novák"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Heslo{user ? ' (nechat prázdné = beze změny)' : ''}</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              placeholder={user ? '••••••' : 'Min. 6 znaků'}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-white">
            <option value="admin">Admin</option>
            <option value="user">Uživatel</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Zrušit
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-amber-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Změnit heslo</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="relative max-w-sm">
        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          placeholder="Nové heslo (min. 6 znaků)" autoFocus
        />
        <button type="button" onClick={() => setShowPw(!showPw)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors">
          <Key size={14} /> {saving ? 'Ukládání...' : 'Změnit heslo'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
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
    <div className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <code className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg">{envKey}</code>
    </div>
  );
}
