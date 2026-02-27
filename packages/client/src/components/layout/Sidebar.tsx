import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Kanban, Mail, FileText,
  Repeat, Download, Settings, LogOut
} from 'lucide-react';

const nav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/contacts', icon: Users, label: 'Kontakty' },
  { to: '/admin/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/admin/campaigns', icon: Mail, label: 'Kampaně' },
  { to: '/admin/templates', icon: FileText, label: 'Šablony' },
  { to: '/admin/sequences', icon: Repeat, label: 'Sekvence' },
  { to: '/admin/import', icon: Download, label: 'Import / Scan' },
  { to: '/admin/settings', icon: Settings, label: 'Nastavení' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('zenuly_auth');
    navigate('/');
  };

  return (
    <aside className="w-[220px] bg-surface border-r border-border flex flex-col min-h-screen fixed left-0 top-0">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-text">
              Zenuly <span className="text-primary-light">CRM</span>
            </h1>
            <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Administrace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg mb-0.5 transition-all ${
                isActive
                  ? 'bg-primary/12 text-primary-light border-r-2 border-primary'
                  : 'text-text-muted hover:bg-surface2 hover:text-text'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-[13px] text-text-dim hover:text-text hover:bg-surface2 rounded-lg transition-all"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
