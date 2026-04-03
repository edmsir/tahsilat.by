import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Sube } from '../types';
import MainLayout from '../components/layout/MainLayout';
import { 
  Users, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SubeCode {
  id: string;
  sube_adi: Sube;
  access_code: string;
  updated_at: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<SubeCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sube_codes')
        .select('*')
        .order('sube_adi');

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error fetching access codes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleShow = (id: string) => {
    setShowCodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (user?.user_metadata?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <ShieldCheck className="w-16 h-16 text-destructive mx-auto mb-4 opacity-20" />
            <h2 className="text-2xl font-bold">Yetkisiz Erişim</h2>
            <p className="text-muted-foreground">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-primary w-6 h-6" />
          Kullanıcı ve Erişim Yönetimi
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Şubelerin benzersiz giriş kodlarını buradan yönetebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="glassmorphism rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="px-6 py-4">Şube Adı</th>
                  <th className="px-6 py-4">Erişim Kodu (Şifre)</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={3} className="px-6 py-4 h-16 bg-muted/20" />
                    </tr>
                  ))
                ) : (
                  codes.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm">{item.sube_adi}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{item.sube_adi.toLowerCase()}@tahsilat.by</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <code className="bg-black/20 px-2 py-1 rounded text-sm font-mono tracking-widest text-primary min-w-[100px] text-center">
                            {showCodes[item.id] ? item.access_code : '••••••••'}
                          </code>
                          <button 
                            onClick={() => toggleShow(item.id)}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            {showCodes[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCopy(item.access_code, item.id)}
                          className="inline-flex items-center gap-2 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-border/50"
                        >
                          {copiedId === item.id ? (
                            <><Check size={14} className="text-green-500" /> Kopyalandı</>
                          ) : (
                            <><Copy size={14} /> Kopyala</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <ShieldCheck className="text-primary w-4 h-4" />
              Sistem Güvenlik Notu
            </h3>
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Önemli:</strong> Buradaki kodlar şube girişlerinde <span className="text-primary font-bold">Şifre</span> yerine geçer.
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-orange-200/80">
                  Kodları şubelerle paylaşırken güvenli kanallar kullanın. Şifrelerin karmaşıklığı güvenliği artırır.
                </p>
              </div>
              <p>
                Yeni bir şube eklendiğinde sistem otomatik olarak kod üretmeyecektir; bu tablonun veritabanından güncellenmesi gerekir.
              </p>
            </div>
            <button 
               onClick={fetchCodes}
               className="w-full mt-6 flex items-center justify-center gap-2 bg-primary py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Listeyi Yenile
            </button>
          </div>

          <div className="glassmorphism p-6 rounded-2xl border border-border/50">
             <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Key className="text-primary w-4 h-4" />
              Giriş Yardımcısı
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase leading-relaxed">
              Yeni giriş sisteminde e-posta yerine "Şube Seçimi" kullanılacaktır. Şubeler sadece kendi benzersiz kodlarını girerek panele erişebilecekler.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
