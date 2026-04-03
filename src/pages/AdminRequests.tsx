import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Talep, Kayit } from '../types';
import MainLayout from '../components/layout/MainLayout';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Trash2, 
  Pencil,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminRequests() {
  const { user } = useAuth();
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const role = user?.user_metadata?.role;

  useEffect(() => {
    fetchTalepler();
  }, []);

  const fetchTalepler = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('talepler')
        .select(`
          *,
          kayitlar (*)
        `)
        .eq('durum', 'BEKLEMEDE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTalepler(data || []);
    } catch (error) {
      console.error('Error fetching talepler:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (talep: Talep) => {
    if (!window.confirm('Bu talebi onaylamak istediğinize emin misiniz? İşlem geri alınamaz.')) return;
    
    setProcessingId(talep.id);
    try {
      if (talep.tip === 'SILME') {
        const { error: delError } = await supabase
          .from('kayitlar')
          .delete()
          .eq('id', talep.kayit_id);
        if (delError) throw delError;
      } else if (talep.tip === 'DUZENLEME' && talep.yeni_veri) {
        const { error: updError } = await supabase
          .from('kayitlar')
          .update(talep.yeni_veri)
          .eq('id', talep.kayit_id);
        if (updError) throw updError;
      }

      // Update request status
      const { error: statusError } = await supabase
        .from('talepler')
        .update({ durum: 'ONAYLANDI' })
        .eq('id', talep.id);
      
      if (statusError) throw statusError;

      alert('Talep başarıyla onaylandı ve işlem gerçekleştirildi.');
      fetchTalepler();
    } catch (error: any) {
      alert('İşlem sırasında hata oluştu: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Bu talebi reddetmek istediğinize emin misiniz?')) return;
    
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('talepler')
        .update({ durum: 'REDDEDİLDİ' })
        .eq('id', id);
      
      if (error) throw error;
      alert('Talep reddedildi.');
      fetchTalepler();
    } catch (error: any) {
      alert('İşlem sırasında hata oluştu: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-4xl text-destructive">🚫</div>
            <h2 className="text-2xl font-bold">Yetkisiz Erişim</h2>
            <p className="text-muted-foreground">Bu sayfayı sadece Merkez yöneticileri görüntüleyebilir.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Onay Bekleyen Talepler</h1>
            <p className="text-xs text-muted-foreground mt-1">Şubelerden gelen düzenleme ve silme isteklerini yönetin.</p>
          </div>
          <button 
            onClick={fetchTalepler}
            className="p-2 bg-muted/50 rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : talepler.length === 0 ? (
          <div className="text-center py-20 glassmorphism rounded-2xl border border-dashed border-border/50">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-500/50" />
              <p className="text-muted-foreground font-medium">Şu an onay bekleyen herhangi bir talep bulunmuyor.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {talepler.map((talep) => (
                <motion.div
                  key={talep.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glassmorphism p-5 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/20 transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Left: Info */}
                    <div className="flex-shrink-0 w-full md:w-48 space-y-2">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${talep.tip === 'SILME' ? 'bg-destructive/10 text-destructive' : 'bg-blue-500/10 text-blue-500'}`}>
                        {talep.tip === 'SILME' ? <Trash2 className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                        {talep.tip === 'SILME' ? 'Silme Talebi' : 'Düzenleme'}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {format(new Date(talep.created_at), 'dd MMM yyyy, HH:mm', { locale: tr })}
                      </div>
                      <div className="text-sm font-bold text-primary">
                        {talep.sube_adi} Şubesi
                      </div>
                    </div>

                    {/* Middle: Content */}
                    <div className="flex-grow space-y-4">
                      {talep.tip === 'SILME' ? (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-destructive">Kayıt Silme İsteği</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Müşteri:</strong> {talep.kayitlar?.musteri_adi} <br />
                              <strong>Tutar:</strong> {talep.kayitlar?.tutar} TL <br />
                              <strong>Tarih:</strong> {talep.kayitlar ? format(new Date(talep.kayitlar.tarih), 'dd.MM.yyyy') : '-'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 rounded-xl p-4 border border-border/30">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Mevcut Veri</p>
                            <div className="text-xs space-y-1 opacity-70">
                              <p>Müşteri: {talep.kayitlar?.musteri_adi}</p>
                              <p>Tutar: {talep.kayitlar?.tutar} TL</p>
                              <p>Taksit: {talep.kayitlar?.taksit}</p>
                              <p>Ödeme: {talep.kayitlar?.banka}</p>
                            </div>
                          </div>
                          <div className="hidden md:flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-primary mb-2">Talep Edilen Veri</p>
                            <div className="text-xs space-y-1">
                              <p className={talep.kayitlar?.musteri_adi !== talep.yeni_veri?.musteri_adi ? 'text-primary font-bold' : ''}>
                                Müşteri: {talep.yeni_veri?.musteri_adi}
                              </p>
                              <p className={talep.kayitlar?.tutar !== talep.yeni_veri?.tutar ? 'text-primary font-bold' : ''}>
                                Tutar: {talep.yeni_veri?.tutar} TL
                              </p>
                              <p className={talep.kayitlar?.taksit !== talep.yeni_veri?.taksit ? 'text-primary font-bold' : ''}>
                                Taksit: {talep.yeni_veri?.taksit}
                              </p>
                              <p className={talep.kayitlar?.banka !== talep.yeni_veri?.banka ? 'text-primary font-bold' : ''}>
                                Ödeme: {talep.yeni_veri?.banka}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-row md:flex-col justify-end gap-2 w-full md:w-32">
                      <button 
                        onClick={() => handleApprove(talep)}
                        disabled={!!processingId}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Onayla
                      </button>
                      <button 
                        onClick={() => handleReject(talep.id)}
                        disabled={!!processingId}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted hover:bg-destructive hover:text-white p-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reddet
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
