import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Sube } from '../types';
import MainLayout from '../components/layout/MainLayout';
import { 
  Target, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Building2,
  Calendar,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { format, getMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

export default function AdminTargets() {
  const { user } = useAuth();
  const [hedefler, setHedefler] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMonth = getMonth(new Date()) + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchHedefler();
  }, []);

  const fetchHedefler = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hedefler')
        .select('*')
        .eq('ay', currentMonth)
        .eq('yil', currentYear);

      if (error) throw error;
      
      const targetMap: Record<string, number> = {};
      data?.forEach(h => {
        targetMap[h.sube_adi] = h.hedef_tutar;
      });
      setHedefler(targetMap);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (sube: string) => {
    const tutar = hedefler[sube] || 0;
    setSaving(sube);
    
    try {
      const { error } = await supabase
        .from('hedefler')
        .upsert({
          sube_adi: sube,
          hedef_tutar: tutar,
          ay: currentMonth,
          yil: currentYear
        }, {
          onConflict: 'sube_adi,ay,yil'
        });

      if (error) throw error;
      
      setSuccess(sube);
      setTimeout(() => setSuccess(null), 2000);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleInputChange = (sube: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setHedefler(prev => ({
      ...prev,
      [sube]: numValue
    }));
  };

  if (user?.user_metadata?.role !== 'admin') {
    return <div className="p-20 text-center font-bold">Yetkisiz Erişim</div>;
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Şube Hedef Yönetimi</h1>
                <p className="text-xs text-muted-foreground font-medium">Bu şubelerin aylık ciro hedeflerini buradan belirleyebilirsiniz.</p>
              </div>
            </div>
          </div>
          
          <div className="glassmorphism px-4 py-2 rounded-xl border border-border/50 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-wider">
              {format(new Date(), 'MMMM yyyy', { locale: tr })}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subeler.map((sube, index) => (
              <motion.div
                key={sube}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glassmorphism p-5 rounded-2xl border border-border/50 hover:border-primary/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Building2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-bold text-sm tracking-wide">{sube}</span>
                  </div>
                  {success === sube && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      className="text-green-500 flex items-center gap-1 text-[10px] font-bold bg-green-500/10 px-2 py-0.5 rounded-full"
                    >
                      <CheckCircle2 className="w-3 h-3" /> KAYDEDİLDİ
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-grow">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₺</div>
                    <input 
                      type="number" 
                      value={hedefler[sube] || ''}
                      onChange={(e) => handleInputChange(sube, e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-muted/30 border border-border/50 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => handleSave(sube)}
                    disabled={saving === sube}
                    className="flex-shrink-0 bg-primary hover:bg-primary/90 text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.95] disabled:opacity-50"
                  >
                    {saving === sube ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span>Aylık Hedef Performansı Takibi Aktif</span>
                  </div>
                  <ChevronRight className="w-3 h-3 opacity-20" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="glassmorphism p-6 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-4">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-1">Hızlı Bilgi</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Belirlediğiniz hedefler anlık olarak ilgili şubenin dashboard ekranındaki progres bar'a yansır. 
              Eğer bir şubeye hedef belirlemezseniz varsayılan olarak 0.00 TL kabul edilir.
              Hedefler her ayın başında o aya özel olarak girilmelidir.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
