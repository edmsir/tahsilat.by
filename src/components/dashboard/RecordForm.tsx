import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Sube, OdemeTuru, Kayit } from '../../types';
import { Loader2, Plus, Save, CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];
const odemeTurleri: OdemeTuru[] = [
  'NAKİT', 'HAVALE / EFT', 'ÇEK', 'SENET', 'AKBANK POS', 'GARANTİ POS', 
  'İŞ BANKASI POS', 'ZİRAAT BANKASI POS', 'YAPI KREDİ POS', 'HALKBANK POS', 
  'QNB FİNANSBANK POS', 'DENİZBANK POS'
];

const formSchema = z.object({
  tarih: z.string(),
  musteri_adi: z.string().min(2, 'Müşteri adı en az 2 karakter olmalıdır'),
  banka: z.string(),
  cekim_subesi: z.string(),
  tutar: z.number().min(1, 'Tutar 0 dan büyük olmalıdır'),
  taksit: z.number().min(1).max(24),
  notlar: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordFormProps {
  onSuccess?: () => void;
  initialData?: Kayit | null;
  onCancel?: () => void;
  isRequest?: boolean;
}

export default function RecordForm({ onSuccess, initialData, onCancel, isRequest }: RecordFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const isEditing = !!initialData;
  const role = user?.user_metadata?.role as string;
  const metadataSube = user?.user_metadata?.sube as Sube;
  const currentSube: Sube = isEditing ? (initialData.sube_adi as Sube) : ((role === 'admin' || !metadataSube) ? 'MERKEZ' : metadataSube);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tarih: new Date().toISOString().split('T')[0],
      banka: 'NAKİT',
      cekim_subesi: currentSube,
      taksit: 1,
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        tarih: initialData.tarih,
        musteri_adi: initialData.musteri_adi,
        banka: initialData.banka,
        cekim_subesi: initialData.cekim_subesi,
        tutar: initialData.tutar,
        taksit: initialData.taksit,
        notlar: initialData.notlar || '',
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setSuccess(false);

    try {
      if (isEditing) {
        if (isRequest) {
          const { error } = await supabase.from('talepler').insert({
            kayit_id: initialData.id,
            tip: 'DUZENLEME',
            yeni_veri: data,
            sube_adi: currentSube,
            talep_eden_id: user?.id,
            durum: 'BEKLEMEDE'
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('kayitlar')
            .update(data)
            .eq('id', initialData.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('kayitlar').insert({
          ...data,
          sube_adi: currentSube,
          user_id: user?.id,
        });
        if (error) throw error;
      }

      setSuccess(true);
      if (!isEditing) {
        reset({
          tarih: new Date().toISOString().split('T')[0],
          banka: 'NAKİT',
          cekim_subesi: currentSube,
          taksit: 1,
        });
      }
      
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error saving record:', error);
      alert('Kayıt kaydedilirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${isEditing ? '' : 'glassmorphism p-4 rounded-xl shadow-lg'} relative overflow-hidden transition-all text-foreground`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${isEditing ? 'bg-blue-500/20' : 'bg-primary/20'} rounded-full flex items-center justify-center`}>
            {isEditing ? <Save className="text-blue-500 w-4 h-4" /> : <Plus className="text-primary w-5 h-5" />}
          </div>
          <h2 className="text-base font-bold leading-none">
            {isEditing ? (isRequest ? 'Düzenleme Talebi Oluştur' : 'Kaydı Düzenle') : 'Yeni Kayıt Girişi'}
          </h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">İşlem Tarihi</label>
            <input
              type="date"
              {...register('tarih')}
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Müşteri / Cari Adı</label>
            <input
              type="text"
              placeholder="Müşteri adı..."
              {...register('musteri_adi')}
              className={`w-full bg-muted/50 border ${errors.musteri_adi ? 'border-destructive' : 'border-border/50'} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ödeme Türü</label>
            <select
              {...register('banka')}
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none"
            >
              {odemeTurleri.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Çekim Şubesi</label>
            <select
              {...register('cekim_subesi')}
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none"
            >
              {subeler.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tutar (TL)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('tutar', { valueAsNumber: true })}
              className={`w-full bg-muted/50 border ${errors.tutar ? 'border-destructive' : 'border-border/50'} rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-1 focus:ring-primary/50 outline-none transition-all`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Taksit</label>
            <input
              type="number"
              placeholder="1"
              {...register('taksit', { valueAsNumber: true })}
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Açıklama</label>
            <input
              type="text"
              placeholder="Notlar..."
              {...register('notlar')}
              className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between gap-4">
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1.5 text-green-500 text-xs font-bold"
              >
                <CheckCircle2 className="w-4 h-4" />
                Başarı ile {isEditing ? (isRequest ? 'talep iletildi' : 'güncellendi') : 'kaydedildi'}
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="ml-auto flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-border hover:bg-muted transition-all"
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${isEditing ? (isRequest ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20') : 'bg-primary hover:bg-primary/90 shadow-primary/20'} text-white`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditing ? (isRequest ? 'Talebi İlet' : 'Güncelle') : 'Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
