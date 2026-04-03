import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import AdminRequests from './pages/AdminRequests';
import AdminTargets from './pages/AdminTargets';
import AdminUsers from './pages/AdminUsers';
import AdminPayments from './pages/AdminPayments';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Sistem yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
      <Route path="/requests" element={(user && user.user_metadata?.role === 'admin') ? <AdminRequests /> : <Navigate to="/" />} />
      <Route path="/targets" element={(user && user.user_metadata?.role === 'admin') ? <AdminTargets /> : <Navigate to="/" />} />
      <Route path="/users" element={(user && user.user_metadata?.role === 'admin') ? <AdminUsers /> : <Navigate to="/" />} />
      <Route path="/payments" element={(user && user.user_metadata?.role === 'admin') ? <AdminPayments /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
