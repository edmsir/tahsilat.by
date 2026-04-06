import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Kayit } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: Kayit | null;
  onSuccess: () => void;
  isRequest?: boolean;
}

export default function EditRecordModal({ isOpen, onClose, record, onSuccess, isRequest }: EditRecordModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    musteri_adi: '',
    tutar: '',
    banka: '',
    cekim_subesi: '',
    taksit: '',
    notlar: ''
  });

  useEffect(() => {
    if (record) {
      setFormData({
        musteri_adi: record.musteri_adi,
        tutar: record.tutar.toString(),
        banka: record.banka,
        cekim_subesi: record.cekim_subesi,
        taksit: record.taksit.toString(),
        notlar: record.notlar || ''
      });
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRequest) {
        // Edit request logic (talepler table)
        const { error } = await supabase.from('talepler').insert({
          kayit_id: record.id,
          tip: 'DUZENLEME',
          sube_adi: user?.user_metadata?.sube,
          talep_eden_id: user?.id,
          durum: 'BEKLEMEDE',
          yeni_veri: {
            ...formData,
            tutar: parseFloat(formData.tutar),
            taksit: parseInt(formData.taksit)
          }
        });
        if (error) throw error;
        alert('Düzenleme talebi başarıyla iletildi. Admin onayından sonra güncellenecektir.');
      } else {
        // Direct admin edit logic (kayitlar table)
        const { error } = await supabase
          .from('kayitlar')
          .update({
            musteri_adi: formData.musteri_adi,
            tutar: parseFloat(formData.tutar),
            banka: formData.banka,
            cekim_subesi: formData.cekim_subesi,
            taksit: parseInt(formData.taksit),
            notlar: formData.notlar,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
        if (error) throw error;
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      alert('İşlem başarısız: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose} 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg glassmorphism rounded-3xl border border-border/50 bg-card shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl">
                <Save className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Kayıt Düzenle</h2>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{isRequest ? 'Düzenleme Talebi' : 'Yönetici Güncellemesi'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Müşteri / Firma Adı</label>
                <input 
                  required
                  type="text" 
                  value={formData.musteri_adi}
                  onChange={e => setFormData({ ...formData, musteri_adi: e.target.value })}
                  className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tutar (TL)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={formData.tutar}
                  onChange={e => setFormData({ ...formData, tutar: e.target.value })}
                  className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ödeme / Banka</label>
                <input 
                  required
                  type="text" 
                  value={formData.banka}
                  onChange={e => setFormData({ ...formData, banka: e.target.value })}
                  className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">POS Şubesi</label>
                <input 
                  required
                  type="text" 
                  value={formData.cekim_subesi}
                  onChange={e => setFormData({ ...formData, cekim_subesi: e.target.value })}
                  className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Taksit</label>
                <input 
                  required
                  type="number" 
                  value={formData.taksit}
                  onChange={e => setFormData({ ...formData, taksit: e.target.value })}
                  className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">İşlem Notları</label>
              <textarea 
                rows={3}
                value={formData.notlar}
                onChange={e => setFormData({ ...formData, notlar: e.target.value })}
                className="w-full bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            {isRequest && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-[10px] font-bold text-orange-600/80 uppercase tracking-tight">
                  Kayıt 3 günden eski olduğu için düzenleme talebi admin onayına düşecektir.
                </p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isRequest ? 'DÜZENLEME TALEBİ GÖNDER' : 'KAYDI GÜNCELLE'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
