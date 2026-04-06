import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Sube, Kayit } from '../../types';
import { Loader2, Plus, Save, CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

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

  const isAdmin = role === 'admin';

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tarih: new Date().toISOString().split('T')[0],
      banka: 'NAKİT',
      cekim_subesi: currentSube,
      taksit: 1,
    }
  });

  const [loadingSettings, setLoadingSettings] = useState(false);
  const [availableInstallments, setAvailableInstallments] = useState<number[]>([1]);
  const [dynamicOdemeTurleri, setDynamicOdemeTurleri] = useState<string[]>([
    'NAKİT', 'HAVALE / EFT', 'ÇEK', 'SENET', 'AKBANK POS', 'GARANTİ POS', 
    'İŞ BANKASI POS', 'ZİRAAT BANKASI POS', 'YAPI KREDİ POS', 'HALKBANK POS', 
    'QNB FİNANSBANK POS', 'DENİZBANK POS'
  ]);
  
  const selectedBanka = watch('banka');
  const selectedTarih = watch('tarih');

  useEffect(() => {
    const fetchBanks = async () => {
      const sabitDefaults = [
        'NAKİT', 'HAVALE / EFT', 'ÇEK', 'SENET',
        'AKBANK POS', 'GARANTİ POS', 'İŞ BANKASI POS', 'ZİRAAT BANKASI POS',
        'YAPI KREDİ POS', 'HALKBANK POS', 'QNB FİNANSBANK POS', 'DENİZBANK POS'
      ];
      try {
        const { data } = await supabase.from('banka_ayarlari')
          .select('banka_adi')
          .neq('is_active', false);
        if (data && data.length > 0) {
          const uniqueBanks = Array.from(new Set(data.map((b: { banka_adi: string }) => b.banka_adi)));
          const combined = Array.from(new Set([...sabitDefaults, ...uniqueBanks]));
          setDynamicOdemeTurleri(combined);
        } else {
          // RLS engeli veya boş tablo - sabit listeyi kullan
          setDynamicOdemeTurleri(sabitDefaults);
        }
      } catch {
        // Hata durumunda da sabit listeyi göster
        setDynamicOdemeTurleri(sabitDefaults);
      }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    const fetchBankSettings = async () => {
      if (!selectedBanka || !selectedBanka.includes('POS')) {
        setAvailableInstallments([1]);
        setValue('taksit', 1);
        return;
      }

      setLoadingSettings(true);
      try {
        // 1. Try to fetch the agreement active on the selected date
        const { data: initialSettings, error: fetchError } = await supabase
          .from('banka_ayarlari')
          .select('komisyon_oranlari')
          .eq('banka_adi', selectedBanka)
          .lte('baslangic_tarihi', selectedTarih)
          .or(`bitis_tarihi.is.null,bitis_tarihi.gte.${selectedTarih}`)
          .order('baslangic_tarihi', { ascending: false })
          .limit(1)
          .maybeSingle();

        let bankSettings = initialSettings;

        if (fetchError) {
            console.error('Banka ayarları çekilirken hata (L100):', fetchError);
        }

        // 2. FALLBACK: If no active agreement found for that date, try to get the latest one anyway
        // This helps if the user entered a date outside the current agreement range or if there's a minor sync issue.
        if (!bankSettings) {
            const { data: latestSettings } = await supabase
                .from('banka_ayarlari')
                .select('komisyon_oranlari')
                .eq('banka_adi', selectedBanka)
                .order('baslangic_tarihi', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (latestSettings) {
                bankSettings = latestSettings;
            }
        }

        if (bankSettings && bankSettings.komisyon_oranlari) {
          const rates = bankSettings.komisyon_oranlari;
          // Extract installment numbers from keys (e.g. "1", "2", "3" ...)
          const insts = Object.keys(rates)
            .map(k => parseInt(k))
            .sort((a, b) => a - b);
          
          setAvailableInstallments(insts.length > 0 ? insts : [1]);
        } else {
          // If still no settings, and it's a POS, log it (likely RLS or no data)
          console.warn(`${selectedBanka} için taksit ayarı bulunamadı. RLS yetkisi veya eksik tanımlama olabilir.`);
          setAvailableInstallments([1]);
        }
      } catch (err) {
        console.error('Banka ayarları fetch hatası (Catch):', err);
        setAvailableInstallments([1]);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchBankSettings();
  }, [selectedBanka, selectedTarih, setValue]);

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

      // IF POS: Generate and Save Payment Schedule
      if (data.banka.includes('POS')) {
        try {
          // 1. Fetch Bank Settings (Agreement active on transaction date)
          const { data: initialBankSettings, error: bankError } = await supabase
            .from('banka_ayarlari')
            .select('*')
            .eq('banka_adi', data.banka)
            .lte('baslangic_tarihi', data.tarih)
            .or(`bitis_tarihi.is.null,bitis_tarihi.gte.${data.tarih}`)
            .order('baslangic_tarihi', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          let bankSettings = initialBankSettings;
          
          if (!bankSettings) {
            // FALLBACK for non-admin or missing agreement: Use a 0-commission default if record saving shouldn't be blocked
            console.warn('Geçerli bir banka anlaşması bulunamadı, 0 komisyon ile plan oluşturulmaya çalışılacak.');
            bankSettings = {
                banka_adi: data.banka,
                vade_gun: 30,
                komisyon_oranlari: { [data.taksit]: 0 }
            };
          }

          if (bankError) {
             console.error('Banka ayarları kontrol hatası:', bankError);
          }

          // 2. Fetch Holidays
          const { data: holidaysData, error: holidayError } = await supabase
            .from('tatil_gunleri')
            .select('tarih');
          
          if (holidayError) throw holidayError;
          const holidayList = (holidaysData || []).map(h => h.tarih);

          // 3. Generate Schedule
          const { generatePaymentSchedule } = await import('../../utils/paymentCalculator');
          const schedule = generatePaymentSchedule(data, bankSettings, holidayList);

          // 4. Save to Database (First find the record ID if it's new)
          let finalRecordId = isEditing ? initialData.id : null;
          
          if (!isEditing) {
            // Get the ID of the record just inserted
            const { data: newRecord, error: fetchError } = await supabase
              .from('kayitlar')
              .select('id')
              .eq('user_id', user?.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (!fetchError) finalRecordId = newRecord.id;
          }

          if (finalRecordId) {
            // Delete old schedule if editing
            if (isEditing) {
              await supabase.from('odeme_plani').delete().eq('kayit_id', finalRecordId);
            }

            // Insert new schedule
            const scheduleToInsert = schedule.map(s => ({
              kayit_id: finalRecordId,
              taksit_no: s.taksit_no,
              planlanan_tarih: s.planlanan_tarih,
              net_tutar: s.net_tutar,
              komisyon_tutar: s.komisyon_tutar,
              ana_tutar: s.ana_tutar,
              durum: 'BEKLEMEDE'
            }));

            await supabase.from('odeme_plani').insert(scheduleToInsert);
          }
        } catch (scheduleErr) {
          console.error('Payment schedule generation failed:', scheduleErr);
        }
      }

      setTimeout(() => setSuccess(false), 2000);
    } catch (error: unknown) {
      console.error('Error saving record:', error);
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Kayıt kaydedilirken bir hata oluştu: ' + message);
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
              {dynamicOdemeTurleri.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Çekim Şubesi</label>
            <select
              {...register('cekim_subesi')}
              disabled={!isAdmin}
              className={`w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
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
            {(() => {
              const isPos = selectedBanka && selectedBanka.includes('POS');
              
              if (!isPos) {
                return (
                  <input
                    type="number"
                    disabled
                    placeholder="1"
                    {...register('taksit', { valueAsNumber: true })}
                    className="w-full bg-muted border border-border/50 rounded-lg px-3 py-1.5 text-sm outline-none opacity-50"
                  />
                );
              }

              // Loading state or options
              if (loadingSettings) {
                return (
                  <div className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-primary" />
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Yükleniyor...</span>
                  </div>
                );
              }

              return (
                <select
                  {...register('taksit', { valueAsNumber: true })}
                  className="w-full bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none"
                >
                  {availableInstallments.map(i => (
                    <option key={i} value={i}>{i} Taksit</option>
                  ))}
                </select>
              );
            })()}
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
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold border border-border hover:bg-muted transition-all order-2 sm:order-1"
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${isEditing ? (isRequest ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20') : 'bg-primary hover:bg-primary/90 shadow-primary/20'} text-white order-1 sm:order-2`}
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
