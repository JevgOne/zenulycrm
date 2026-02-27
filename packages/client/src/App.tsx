import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Pipeline from './pages/Pipeline';
import Campaigns from './pages/Campaigns';
import Templates from './pages/Templates';
import Import from './pages/Import';
import Sequences from './pages/Sequences';
import Settings from './pages/Settings';
import { isLoggedIn } from './api/client';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AdminLayout() {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 ml-[220px] p-6 bg-grid">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/sequences" element={<Sequences />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={<AdminLayout />} />
      <Route path="/contacts" element={<Navigate to="/admin/contacts" replace />} />
      <Route path="/pipeline" element={<Navigate to="/admin/pipeline" replace />} />
      <Route path="/campaigns" element={<Navigate to="/admin/campaigns" replace />} />
      <Route path="/templates" element={<Navigate to="/admin/templates" replace />} />
      <Route path="/sequences" element={<Navigate to="/admin/sequences" replace />} />
      <Route path="/import" element={<Navigate to="/admin/import" replace />} />
      <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
    </Routes>
  );
}
