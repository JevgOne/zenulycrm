import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Kanban, Mail, FileText,
  Repeat, Download, Settings
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Kontakty' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/campaigns', icon: Mail, label: 'Kampaně' },
  { to: '/templates', icon: FileText, label: 'Šablony' },
  { to: '/sequences', icon: Repeat, label: 'Sekvence' },
  { to: '/import', icon: Download, label: 'Import / Scan' },
  { to: '/settings', icon: Settings, label: 'Nastavení' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-brand-400">Weblyx</span> CRM
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Lead Management</p>
      </div>

      <nav className="flex-1 py-3">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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

      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        weblyx.cz
      </div>
    </aside>
  );
}
