import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { LogIn, KeyRound, Building2, AlertCircle } from 'lucide-react';
import type { Sube } from '../types';

const subeler: string[] = ['YÖNETİCİ', 'MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

export default function Login() {
  const [selectedSube, setSelectedSube] = useState<Sube | ''>(() => {
    return (localStorage.getItem('rememberedSube') as Sube) || '';
  });
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') === 'true';
  });
  const [accessCode, setAccessCode] = useState(() => {
    return rememberMe ? localStorage.getItem('rememberedCode') || '' : '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSube) {
      setError('Lütfen şube seçiniz.');
      return;
    }
    
    setLoading(true);
    setError(null);

    // E-posta adresini şube adıyla eşliyoruz (Türkçe karakter sorununu aşmak için sabit harita)
    const emailMap: Record<string, string> = {
      'YÖNETİCİ': 'admin@tahsilat.by',
      'MERKEZ': 'merkez@tahsilat.by',
      'ANKARA': 'ankara@tahsilat.by',
      'BURSA': 'bursa@tahsilat.by',
      'BAYRAMPAŞA': 'bayrampasa@tahsilat.by',
      'MODOKO': 'modoko@tahsilat.by',
      'İZMİR': 'izmir@tahsilat.by',
      'MALZEME': 'malzeme@tahsilat.by'
    };
    
    const email = emailMap[selectedSube as Sube];

    if (rememberMe) {
      localStorage.setItem('rememberedSube', selectedSube);
      localStorage.setItem('rememberedCode', accessCode);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberedSube');
      localStorage.removeItem('rememberedCode');
      localStorage.setItem('rememberMe', 'false');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: accessCode,
    });

    if (error) {
       // Kullanıcıya her zaman şifre/kod hatalı diyelim, Supabase Auth mesajlarını Türkçeleştirelim
      setError('Şube veya Erişim Kodu hatalı!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glassmorphism p-8 rounded-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg shadow-primary/50">
            <LogIn className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Erişim Portalı</h1>
          <p className="text-gray-400 mt-2">Şube kodunuz ile giriş yapın.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Şube</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <select
                required
                value={selectedSube}
                onChange={(e) => setSelectedSube(e.target.value as Sube)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                <option value="" disabled className="text-gray-900">Şube Seçiniz</option>
                {subeler.map(s => (
                   <option key={s} value={s} className="text-gray-900 font-bold">{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Erişim Kodu</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toLocaleUpperCase('tr-TR'))}
                placeholder="Örn: AB12C3D4"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono tracking-widest uppercase"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="flex items-center justify-between ml-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-4 w-4 appearance-none rounded border border-white/20 bg-white/5 checked:bg-primary checked:border-primary transition-all duration-200"
                />
                <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 top-0.5 left-0.5 pointer-events-none transition-opacity duration-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Beni Hatırla</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Doğrulanıyor...' : 'Sisteme Gir'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-500">
          &copy; 2026 Tahsilat Sistemi v1.2
        </div>
      </motion.div>
    </div>
  );
}
