import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Pipeline from './pages/Pipeline';
import Campaigns from './pages/Campaigns';
import Templates from './pages/Templates';
import Import from './pages/Import';
import Sequences from './pages/Sequences';

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/sequences" element={<Sequences />} />
          <Route path="/import" element={<Import />} />
        </Routes>
      </main>
    </div>
  );
}
