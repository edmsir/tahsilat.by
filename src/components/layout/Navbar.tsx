import { useAuth } from '../../hooks/useAuth';
import { LogOut, LayoutDashboard, FileSpreadsheet, UserCircle, Menu, X, PlusCircle, CalendarClock, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import logo from '../../assets/logo.png';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  
  const role = user?.app_metadata?.role || 'branch';
  const sube = user?.app_metadata?.sube || 'Bilinmiyor';

  useEffect(() => {
    if (role !== 'admin') return;

    const fetchPendingCount = async () => {
      const { count, error } = await supabase
        .from('talepler')
        .select('*', { count: 'exact', head: true })
        .eq('durum', 'BEKLEMEDE');
      
      if (!error && count !== null) {
        setPendingCount(count);
      }
    };

    fetchPendingCount();

    // Real-time subscription to update count
    const channel = supabase
      .channel('talepler-changes')
      .on('postgres_changes', { event: '*', table: 'talepler', schema: 'public' }, fetchPendingCount)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', role: 'all' },
    { name: 'Raporlar', icon: FileSpreadsheet, path: '/reports', role: 'admin' },
    { name: 'Talepler', icon: PlusCircle, path: '/requests', role: 'admin' },
    { name: 'Ödemeler', icon: CalendarClock, path: '/payments', role: 'admin' },
    { name: 'Sistem Yönetimi', icon: ShieldCheck, path: '/settings', role: 'admin' },
  ];

  const filteredItems = navItems.filter(item => 
    item.role === 'all' || item.role === role
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-3 group">
              <div className="h-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                 <img src={logo} alt="Firma Logo" className="h-full w-auto object-contain drop-shadow-lg" />
              </div>
              <span className="text-sm font-black tracking-widest hidden sm:block uppercase text-foreground/90 leading-tight">
                BY FABRIC<br/><span className="text-[9px] text-primary">YÖNETİM SİSTEMİ</span>
              </span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:space-x-4">
              {filteredItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`inline-flex items-center px-4 py-2 text-sm font-bold transition-all rounded-lg ${
                    isActive(item.path) 
                      ? 'text-primary bg-primary/5' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                  {item.name === 'Talepler' && pendingCount > 0 && (
                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-lg animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
              <UserCircle className="w-4 h-4 text-primary" />
              <span className="uppercase tracking-wider">{sube}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/5"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border bg-card overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-bold transition-all ${
                    isActive(item.path)
                      ? 'text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                    {item.name === 'Talepler' && pendingCount > 0 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white shadow-lg">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              <div className="border-t border-border mt-4 pt-4 px-3 flex justify-between items-center pb-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <UserCircle className="w-5 h-5 text-primary" />
                  <span className="uppercase">{sube}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center text-destructive text-sm font-bold"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Çıkış
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
