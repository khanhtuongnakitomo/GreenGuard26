import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar }   from './components/layout/Sidebar';
import { TopBar }    from './components/layout/TopBar';
import Dashboard     from './pages/Dashboard';
import History       from './pages/History';
import Machine       from './pages/Machine';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/"        element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/machine" element={<Machine />} />
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
