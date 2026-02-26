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
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              Zenuly <span className="text-brand-400">CRM</span>
            </h1>
            <p className="text-[10px] text-gray-500 -mt-0.5">Administrace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-300 border-r-2 border-brand-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
