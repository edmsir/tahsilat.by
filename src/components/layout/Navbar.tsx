import { useAuth } from '../../hooks/useAuth';
import { LogOut, LayoutDashboard, FileSpreadsheet, UserCircle, Menu, X, PlusCircle, Target, Users, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  
  const role = user?.user_metadata?.role || 'branch';
  const sube = user?.user_metadata?.sube || 'Bilinmiyor';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', role: 'all' },
    { name: 'Raporlar', icon: FileSpreadsheet, path: '/reports', role: 'admin' },
    { name: 'Talepler', icon: PlusCircle, path: '/requests', role: 'admin' },
    { name: 'Hedefler', icon: Target, path: '/targets', role: 'admin' },
    { name: 'Ödemeler', icon: CalendarClock, path: '/payments', role: 'admin' },
    { name: 'Kullanıcılar', icon: Users, path: '/users', role: 'admin' },
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
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <LayoutDashboard className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight hidden sm:block">Şube Takip</span>
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
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
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
