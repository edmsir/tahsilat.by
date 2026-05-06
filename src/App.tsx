import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import AdminRequests from './pages/AdminRequests';
import AdminSettings from './pages/AdminSettings';
import AdminPayments from './pages/AdminPayments';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from './assets/logo.png';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090E] relative overflow-hidden">
        {/* Animated Orbs for loading state */}
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse delay-700" />
        
        <motion.div 
           initial={{ scale: 0.8, opacity: 0.5 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
           className="relative z-10 flex flex-col items-center gap-6"
        >
          {/* Logo with Glow */}
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/40 rounded-full blur-2xl z-0" />
            <img src={logo} alt="Sistem Yükleniyor..." className="w-32 h-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] relative z-10" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
             <Loader2 className="w-6 h-6 text-primary animate-spin" />
             <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/50 animate-pulse">SİSTEM BAŞLATILIYOR...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
      <Route path="/requests" element={(user && user.app_metadata?.role === 'admin') ? <AdminRequests /> : <Navigate to="/" />} />
      <Route path="/settings" element={(user && user.app_metadata?.role === 'admin') ? <AdminSettings /> : <Navigate to="/" />} />
      <Route path="/payments" element={(user && user.app_metadata?.role === 'admin') ? <AdminPayments /> : <Navigate to="/" />} />
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
