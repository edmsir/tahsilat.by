import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { KeyRound, Building2, AlertCircle, Loader2 } from 'lucide-react';
import type { Sube } from '../types';
import { logAction } from '../utils/logger';
import logo from '../assets/logo.png';

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
      setError('Lütfen yetki bölgesi seçiniz.');
      return;
    }
    
    setLoading(true);
    setError(null);

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
      await logAction({
        subeAdi: selectedSube,
        action: 'HATA',
        details: { islem: 'LOGIN_FAILED', message: error.message, email }
      });
      setError('Bölge veya Güvenlik Kodu hatalı!');
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        userId: user?.id,
        subeAdi: selectedSube,
        action: 'LOGIN',
        details: { islem: 'LOGIN_SUCCESS', email }
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090E] relative overflow-hidden p-4 font-sans selection:bg-primary/30">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen delay-1000" />
      
      {/* Optional: Noise overlay for Premium Texture (uncomment if desired)
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div> 
      */}

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            className="p-1 mb-6 relative group"
          >
            {/* Glowing effect behind the logo */}
            <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-2xl group-hover:bg-primary/50 transition-all duration-700 -z-10 scale-75" />
            
            {/* The Logo */}
            <img 
              src={logo} 
              alt="Firma Logo" 
              className="w-32 h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transform group-hover:scale-105 transition-transform duration-500" 
            />
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-black text-white tracking-widest uppercase"
          >
            Erişim Portalı
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[10px] font-bold text-gray-400 mt-2 tracking-[0.2em] uppercase"
          >
            Sistem Güvenlik Doğrulaması
          </motion.p>
        </div>

        {/* Form Container */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-8 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[2rem] pointer-events-none" />

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Kullanıcı / Bölge Yetkisi</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none z-10">
                  <Building2 className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
                <select
                  required
                  value={selectedSube}
                  onChange={(e) => setSelectedSube(e.target.value as Sube)}
                  className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none rounded-2xl py-4 pl-14 pr-4 text-white appearance-none transition-all font-bold text-sm shadow-inner"
                >
                  <option value="" disabled className="text-gray-900">YETKİ BÖLGESİ SEÇİNİZ</option>
                  {subeler.map(s => (
                     <option key={s} value={s} className="text-gray-900 font-bold">{s}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
                  <div className="w-3 h-3 border-b-2 border-r-2 border-gray-500 rotate-45 transform -translate-y-1 group-focus-within:border-primary transition-colors"></div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Güvenlik Kodu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none z-10">
                  <KeyRound className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toLocaleUpperCase('tr-TR'))}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none rounded-2xl py-4 pl-14 pr-4 text-white placeholder:text-gray-600 transition-all font-mono tracking-[0.3em] font-black uppercase text-lg shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-between ml-1 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-5 w-5 appearance-none rounded-lg border-2 border-white/20 bg-black/40 checked:bg-primary checked:border-primary transition-all duration-200"
                  />
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 top-1 left-1 pointer-events-none transition-opacity duration-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-gray-500 group-hover:text-gray-300 transition-colors">Cihazı Hatırla</span>
              </label>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold p-4 rounded-2xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'DOGRULANIYOR...' : 'SİSTEME GİRİŞ YAP'}
            </button>
          </form>
        </motion.div>

        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.8 }}
           className="mt-8 text-center"
        >
          <div className="text-[10px] font-bold text-gray-600 tracking-widest uppercase">
            &copy; 2026 BY FABRIC YÖNETİM SİSTEMİ
          </div>
          <div className="text-[8px] text-gray-700 mt-1 uppercase tracking-widest">
             Güvenli Veri Altyapısı
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
