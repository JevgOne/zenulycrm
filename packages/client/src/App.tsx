import { Component, type ReactNode } from 'react';
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
import Scanner from './pages/Scanner';
import { isLoggedIn } from './api/client';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#0a0a0b', color: '#ff6b6b', minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace', padding: 40,
        }}>
          <div style={{ maxWidth: 600 }}>
            <h1 style={{ color: '#f0eef8', marginBottom: 16 }}>Chyba aplikace</h1>
            <pre style={{
              background: '#111114', padding: 20, borderRadius: 12,
              overflow: 'auto', fontSize: 13, lineHeight: 1.6,
              border: '1px solid #1e1e26',
            }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{
                marginTop: 16, padding: '10px 20px', background: '#7b6cff',
                color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Obnovit stránku
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
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
            <Route path="/scanner" element={<Scanner />} />
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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
