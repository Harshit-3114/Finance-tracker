import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './pages/Dashboard/Dashboard';
import Transactions from './pages/Transactions/Transactions';
import Calendar from './pages/Calendar/Calendar';
import Budget from './pages/Budget/Budget';
import Categories from './pages/Categories/Categories';
import RecycleBin from './pages/RecycleBin/RecycleBin';
import Auth from './pages/Auth/Auth';
import { AuthProvider } from './context/AuthContext';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/recycle-bin" element={<RecycleBin />} />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
