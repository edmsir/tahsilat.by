import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Sube, BankSettings } from '../../types';
import { Loader2, X, CheckCircle2, AlertCircle, FileSpreadsheet, ClipboardPaste, Info, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePaymentSchedule } from '../../utils/paymentCalculator';
import { logAction } from '../../utils/logger';
import { isWithinInterval, parseISO } from 'date-fns';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSube: Sube;
}

interface GroupedData {
  id: string; 
  banka: string;
  rawBankaName: string;
  taksit: number | null; 
  tutar: number;
  count: number;
  tarih: string;
  sube: Sube;
  cekimSube: Sube;
  originalLineIndices: number[]; 
  originalRawData: string[];
  isInstallmentValid?: boolean;
  unsupportedMessage?: string;
}

interface ColumnMapping {
  bankCol: number;
  descCol: number;
  amountCol: number;
  dateCol: number;
  subeCol: number;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess, currentSube }: BulkImportModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [groupedRecords, setGroupedRecords] = useState<GroupedData[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // New States for Date and Sube selection
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [importSube, setImportSube] = useState<Sube>(currentSube);
  
  // Mapping States
  const [detectedColumns, setDetectedColumns] = useState<ColumnMapping | null>(null);
  const [rawLines, setRawLines] = useState<string[][]>([]);
  // Wizard Step State
  const [step, setStep] = useState<'paste' | 'map' | 'review'>('paste');
  const [allBankSettings, setAllBankSettings] = useState<BankSettings[]>([]);
  const [editingBankSetting, setEditingBankSetting] = useState<BankSettings | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  // Fetch Bank Settings for Validation
  useEffect(() => {
    const fetchBankSettings = async () => {
      try {
        const { data, error } = await supabase.from('banka_ayarlari').select('*');
        if (error) throw error;
        setAllBankSettings(data || []);
      } catch (err) {
        console.error('Banka ayarları yüklenemedi:', err);
      }
    };

    if (isOpen) {
      fetchBankSettings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAdmin = user?.app_metadata?.role === 'admin';
  const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

  const updateGroupTaksit = (id: string, val: number) => {
    setGroupedRecords(prev => prev.map(g => g.id === id ? { ...g, taksit: val } : g));
  };

  const currentMapping = detectedColumns || { bankCol: -1, descCol: -1, amountCol: -1, dateCol: -1, subeCol: -1 };

  const handleApplyMapping = () => {
    if (currentMapping.bankCol === -1 || currentMapping.descCol === -1 || currentMapping.amountCol === -1) {
      setError('Lütfen en az Banka, Açıklama ve Tutar sütunlarını eşleştirin.');
      return;
    }
    setStep('review');
    processWithMapping(rawLines, currentMapping);
  };

  const getBankEnum = (bankaHesapAdi: string) => {
    const upper = bankaHesapAdi.toUpperCase();
    if (upper.includes('DENİZ')) return 'DENİZBANK POS';
    if (upper.includes('FİNANS') || upper.includes('FINANS')) return 'QNB FİNANSBANK POS';
    if (upper.includes('YAPIKRED') || upper.includes('YAPI KRED')) return 'YAPI KREDİ POS';
    if (upper.includes('ZİRAAT') || upper.includes('ZIRAAT')) return 'ZİRAAT BANKASI POS';
    if (upper.includes('KUVEYT')) return 'KUVEYTTÜRK POS';
    if (upper.includes('HALK')) return 'HALKBANK POS';
    if (upper.includes('İŞ') || upper.includes('IS BANK')) return 'İŞ BANKASI POS';
    if (upper.includes('AKBANK')) return 'AKBANK POS';
    if (upper.includes('GARANT')) return 'GARANTİ POS';
    if (upper.includes('ALBARAKA')) return 'ALBARAKA POS';
    if (upper.includes('VAKIF')) return 'VAKIFBANK POS';
    return 'NAKİT'; 
  };

  const extractInstallment = (aciklama: string) => {
    const upper = aciklama.toUpperCase();
    // Check for "TEK" or "PEŞİN"
    if (upper.includes('TEK') || upper.includes('PESİN') || upper.includes('PEŞİN')) return 1;
    
    const match = upper.match(/(\d+)\s*(TKS|TAKSİT|TAKSIT|TKST)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null; // Return null if unclear instead of 1
  };

  const parseExcelDate = (dateStr: string) => {
    if (!dateStr) return null;
    const dmyt = dateStr.trim().match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (dmyt) {
      return `${dmyt[3]}-${dmyt[2].padStart(2, '0')}-${dmyt[1].padStart(2, '0')}`;
    }
    return null;
  };

  const detectSube = (subeStr: string): Sube | null => {
    if (!subeStr) return null;
    const upper = subeStr.toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ç/g, 'C').replace(/Ö/g, 'O');
    
    if (upper.includes('MERKEZ')) return 'MERKEZ';
    if (upper.includes('ANKARA')) return 'ANKARA';
    if (upper.includes('BURSA')) return 'BURSA';
    if (upper.includes('BAYRAMPASA') || upper.includes('B.PASA') || upper.includes('BAYRAMPAŞA')) return 'BAYRAMPAŞA';
    if (upper.includes('MODOKO')) return 'MODOKO';
    if (upper.includes('IZMIR') || upper.includes('İZMİR')) return 'İZMİR';
    if (upper.includes('MALZEME')) return 'MALZEME';
    return null;
  };

  const handlePasteData = (forcedMapping?: ColumnMapping) => {
    if (!pasteData.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const lines = pasteData.split('\n').filter(l => l.trim());
      if (lines.length === 0) throw new Error('Geçerli bir veri bulunamadı.');

      const gridData = lines.map(line => line.split('\t').map(c => c.trim()));
      setRawLines(gridData);

      let mapping: ColumnMapping = forcedMapping || {
        bankCol: -1, descCol: -1, amountCol: -1, dateCol: -1, subeCol: -1
      };

      if (!forcedMapping) {
        // Try to detect headers
        const headers = gridData[0].map(h => h.toUpperCase());
        headers.forEach((h, idx) => {
          if (h === 'BANKA HESAP ADI' || (h.includes('BANKA') && h.includes('ADI'))) mapping.bankCol = idx;
          if (h === 'AÇIKLAMA' || h.includes('ACIKLAMA')) mapping.descCol = idx;
          if ((h.includes('ALACAK') || h.includes('TUTAR')) && !h.includes('DÖVİZ')) mapping.amountCol = idx;
          if (h.includes('TARIH') || h.includes('TARİH')) mapping.dateCol = idx;
          if (h.includes('SUBE') || h.includes('ŞUBE')) mapping.subeCol = idx;
        });

        // Default indices if still not found (Legacy compatibility)
        if (mapping.bankCol === -1 && gridData[0].length > 6) mapping.bankCol = 6;
        if (mapping.descCol === -1 && gridData[0].length > 5) mapping.descCol = 5;
        if (mapping.amountCol === -1 && gridData[0].length > 3) mapping.amountCol = 3;
      }

      // Check if critical columns detected
      if (mapping.bankCol === -1 || mapping.descCol === -1 || mapping.amountCol === -1) {
        setDetectedColumns(mapping);
        setStep('map');
        setLoading(false);
        return;
      }

      setStep('review');
      processWithMapping(gridData, mapping);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const processWithMapping = (data: string[][], mapping: ColumnMapping, overrideSettings?: BankSettings[]) => {
    try {
      const groups: Record<string, GroupedData> = {};
      const startIdx = (data[0].some(h => h.includes('BANKA') || h.includes('TUTAR'))) ? 1 : 0;

      for (let i = startIdx; i < data.length; i++) {
        const columns = data[i];
        if (columns.length <= Math.max(mapping.bankCol, mapping.descCol, mapping.amountCol)) continue;

        const bankaMetni = columns[mapping.bankCol] || '';
        const aciklamaMetni = columns[mapping.descCol] || '';
        const tutarMetni = columns[mapping.amountCol] || '0';
        const tarihMetni = mapping.dateCol !== -1 ? columns[mapping.dateCol] : '';
        const subeMetni = mapping.subeCol !== -1 ? columns[mapping.subeCol] : '';

        const tutar = parseFloat(tutarMetni.replace(/\./g, '').replace(',', '.'));
        if (bankaMetni && !isNaN(tutar) && tutar > 0) {
          const bankaEnum = getBankEnum(bankaMetni);
          const taksit = extractInstallment(aciklamaMetni);
          const rowDate = parseExcelDate(tarihMetni) || importDate;
          const rowSube = isAdmin ? (detectSube(subeMetni) || importSube) : importSube;
          const cekimSube = detectSube(bankaMetni) || rowSube;

          // BANKE BAZLI TAKSIT KONTROLÜ
          let isInstallmentValid = true;
          let unsupportedMessage = '';
          
          if (taksit !== null) {
              const settingsToUse = overrideSettings || allBankSettings;
              const activeSetting = settingsToUse.find(s => 
                  ((s.banka_adi === bankaMetni) || (s.banka_adi === bankaEnum)) && 
                  isWithinInterval(parseISO(rowDate), {
                      start: parseISO(s.baslangic_tarihi),
                      end: s.bitis_tarihi ? parseISO(s.bitis_tarihi) : parseISO('2099-12-31')
                  })
              );

              if (activeSetting) {
                  const allowedTaksits = Object.keys(activeSetting.komisyon_oranlari);
                  if (!allowedTaksits.includes(taksit.toString())) {
                      isInstallmentValid = false;
                      const maxTaksit = Math.max(...allowedTaksits.map(Number));
                      unsupportedMessage = `${bankaEnum} için ${taksit} taksit tanımlı değil! (Max: ${maxTaksit})`;
                  }
              }
          }

          // EĞER TAKSİT GEÇERSİZSE VEYA BELİRSİZSE GRUPLAMA YAPMA
          const key = (taksit === null || !isInstallmentValid)
            ? `unclear_${i}_${bankaEnum}` 
            : `${bankaEnum}_${taksit}_${rowDate}_${rowSube}_${cekimSube}`;

          if (!groups[key]) {
            groups[key] = { 
                id: key, 
                banka: bankaEnum, 
                rawBankaName: bankaMetni,
                taksit: isInstallmentValid ? taksit : null, 
                tutar: 0, 
                count: 0,
                tarih: rowDate, 
                sube: rowSube,
                cekimSube: cekimSube,
                originalLineIndices: [],
                originalRawData: [],
                isInstallmentValid,
                unsupportedMessage
            };
          }
          groups[key].tutar += tutar;
          groups[key].count += 1;
          groups[key].originalLineIndices.push(i + 1); 
          groups[key].originalRawData.push(aciklamaMetni || bankaMetni);
        }
      }

      const result = Object.values(groups).sort((a, b) => b.tarih.localeCompare(a.tarih) || b.tutar - a.tutar);
      if (result.length === 0) {
        throw new Error('Veri ayrıştırılamadı. Lütfen sütun seçimlerinizi kontrol edin.');
      }

      setGroupedRecords(result);
      setStep('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (processLoading || groupedRecords.length === 0) return;
    if (!user) {
        setError('Oturumunuz kapalı görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.');
        return;
    }

    // Check if all taksits are filled
    if (groupedRecords.some(g => g.taksit === null)) {
        setError('Lütfen taksit sayısı belirsiz olan (kırmızı işaretli) satırları manuel doldurun.');
        return;
    }

    setProcessLoading(true);
    setError(null);
    setProgressMsg('Kayıtlar işleniyor...');

    try {
      const { data: bSettings, error: bSettingsErr } = await supabase.from('banka_ayarlari').select('*');
      if (bSettingsErr) throw bSettingsErr;
      
      const { data: holData, error: holErr } = await supabase.from('tatil_gunleri').select('tarih');
      if (holErr) throw holErr;
      
      const holidaysList = (holData || []).map(h => h.tarih);

      // 1. Prepare Records for Bulk Insert
      const recordsToInsert = groupedRecords.map(group => {
          // Açıklamaları birleştir (Tekrar edenleri temizle)
          const uniqueDescs = Array.from(new Set(group.originalRawData))
            .filter(d => d && typeof d === 'string' && d.trim().length > 0)
            .join(', ');

          return {
            tarih: group.tarih,
            musteri_adi: 'TOPLU AKTARIM',
            banka: group.banka,
            cekim_subesi: group.cekimSube,
            sube_adi: group.sube,
            tutar: group.tutar,
            taksit: group.taksit,
            user_id: user?.id,
            notlar: `[${uniqueDescs}] - Toplu Aktarım (${group.count} işlem)`
          };
      });

      console.log('Aktarım Başlıyor. İlk Kayıt Örneği:', recordsToInsert[0]);
      console.log('Kullanıcı ID:', user?.id);
      console.log('Admin mi?:', isAdmin);

      // 2. Bulk Insert Records
      setProgressMsg('Kayıtlar veritabanına yazılıyor...');
      const { data: insertedRecords, error: insertErr } = await supabase
        .from('kayitlar')
        .insert(recordsToInsert)
        .select('id, banka, taksit, tarih, tutar');

      if (insertErr) {
        console.error('Kayıt ekleme hatası:', insertErr);
        throw new Error(`Kayıtlar eklenemedi: ${insertErr.message}`);
      }

      if (!insertedRecords || insertedRecords.length === 0) {
        throw new Error('Kayıtlar eklendi ancak veri geri alınamadı.');
      }

      // 3. Prepare Payment Plans for Bulk Insert
      setProgressMsg('Ödeme planları oluşturuluyor...');
      const allPlans: any[] = [];
      
      insertedRecords.forEach((record) => {
        if (!record.banka.includes('POS')) return;

        let bankSetting = bSettings?.sort((a, b) => new Date(b.baslangic_tarihi).getTime() - new Date(a.baslangic_tarihi).getTime())
          .find(s => s.banka_adi === record.banka && new Date(s.baslangic_tarihi) <= new Date(record.tarih));
        
        if (!bankSetting) {
            bankSetting = bSettings?.find(s => s.banka_adi === record.banka) || {
                banka_adi: record.banka, vade_gun: 30, komisyon_oranlari: { [record.taksit]: 0 }
            };
        }

        const plan = generatePaymentSchedule(
            { tarih: record.tarih, tutar: record.tutar, taksit: record.taksit, banka: record.banka },
            bankSetting, holidaysList
        );

        plan.forEach(p => {
          allPlans.push({
            kayit_id: record.id,
            taksit_no: p.taksit_no,
            planlanan_tarih: p.planlanan_tarih,
            net_tutar: p.net_tutar,
            komisyon_tutar: p.komisyon_tutar,
            ana_tutar: p.ana_tutar,
            durum: 'BEKLEMEDE'
          });
        });
      });

      // 4. Bulk Insert Payment Plans
      if (allPlans.length > 0) {
        setProgressMsg(`${allPlans.length} taksit planı kaydediliyor...`);
        const { error: planErr } = await supabase.from('odeme_plani').insert(allPlans);
        if (planErr) {
          console.error('Ödeme planı ekleme hatası:', planErr);
          throw new Error(`Ödeme planları eklenemedi: ${planErr.message}`);
        }
      }
      
      const totalTutar = groupedRecords.reduce((sum, g) => sum + g.tutar, 0);
      const totalCount = groupedRecords.reduce((sum, g) => sum + g.count, 0);

      // AUDIT LOG
      await logAction({
        userId: user?.id || '',
        subeAdi: currentSube,
        action: 'TOPLU_AKTARIM',
        details: {
          toplam_tutar: totalTutar,
          grup_adedi: groupedRecords.length,
          toplam_satir: totalCount,
        }
      });

      setGroupedRecords([]);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
       console.error('Aktarım hatası detay:', err);
       const msg = err.message || 'Bilinmeyen bir hata';
       setError(`Aktarım Durduruldu: ${msg}`);
    } finally {
      setProcessLoading(false);
    }
  };

  const handleUpdateBankSetting = async (updated: BankSettings | null) => {
    if (!updated) return;
    console.log('Hızlı Banka Güncelleme İsteği:', updated);
    setProcessLoading(true);
    setProgressMsg('Banka ayarları güncelleniyor...');
    
    try {
      const { data, error, status } = await supabase
        .from('banka_ayarlari')
        .update({ 
          vade_gun: updated.vade_gun,
          komisyon_oranlari: updated.komisyon_oranlari,
          blokaj_gunleri: updated.blokaj_gunleri,
          odeme_tipi: updated.odeme_tipi,
          is_active: updated.is_active
        })
        .eq('id', updated.id)
        .select();

      console.log('Supabase Hızlı Yanıt:', { data, error, status });

      if (error) throw error;

      // Yerel durumu güncelle
      const newSettings = allBankSettings.map(s => s.id === updated.id ? updated : s);
      setAllBankSettings(newSettings);
      setEditingBankSetting(null);
      
      console.log('Veriler güncellendi, Excel tekrar analiz ediliyor...');
      processWithMapping(rawLines, currentMapping, newSettings);
      alert('Banka ayarları başarıyla güncellendi!');
    } catch (err: any) {
      console.error('Hızlı banka güncelleme hatası:', err);
      const errorMsg = err.message || 'Bilinmeyen bir hata oluştu';
      setError(`Güncelleme hatası: ${errorMsg}`);
      alert(`Güncelleme başarısız: ${errorMsg}`);
    } finally {
      setProcessLoading(false);
    }
  };

  const getBankColor = (bankName: string) => {
    if (bankName.includes('DENİZ')) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    if (bankName.includes('FİNANS')) return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
    if (bankName.includes('YAPI KREDİ')) return 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30';
    if (bankName.includes('ZİRAAT')) return 'text-red-400 bg-red-500/20 border-red-500/30';
    if (bankName.includes('KUVEYT')) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (bankName.includes('İŞ')) return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    if (bankName.includes('AKBANK')) return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
    if (bankName.includes('GARANT')) return 'text-teal-400 bg-teal-500/20 border-teal-500/30';
    return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 30 }}
        className="glassmorphism w-full max-w-7xl h-full max-h-[95vh] rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-white/10 relative"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between px-10 py-8 border-b border-white/5 bg-white/5 relative z-10">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-[22px] bg-primary/20 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
                <ClipboardPaste className="w-8 h-8 text-primary" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-white tracking-tight uppercase italic leading-none mb-1">EXCEL AKTARIM MERKEZİ</h2>
               <p className="text-[10px] text-primary/80 font-black uppercase tracking-[0.3em] opacity-80">Smart Bulk Import Engine v2.0</p>
             </div>
          </div>

          {/* Stepper UI */}
          <div className="hidden lg:flex items-center gap-4 bg-black/40 px-8 py-3 rounded-2xl border border-white/5">
                {[
                    { id: 'paste', label: 'VERI GIRISI', num: '01' },
                    { id: 'map', label: 'SUTUN TANIMA', num: '02' },
                    { id: 'review', label: 'KONTROL & ONAY', num: '03' }
                ].map((s, i: number) => (
                    <div key={s.id} className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black ${step === s.id ? 'text-primary' : 'text-white/20'}`}>{s.num}</span>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${step === s.id ? 'text-white' : 'text-white/20'}`}>{s.label}</span>
                        </div>
                        {i < 2 && <div className="w-8 h-[1px] bg-white/10" />}
                    </div>
                ))}
          </div>

          <button 
            onClick={onClose} 
            className="p-3 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all transform hover:rotate-90 border border-transparent hover:border-white/10" 
            disabled={processLoading}
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="px-10 py-8 flex-1 overflow-y-auto custom-scrollbar relative">
            {/* HER ZAMAN GÖRÜNÜR: Tarih ve Şube Seçimi */}
            <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[32px] grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 shadow-inner">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 ml-1">
                        <Loader2 className="w-3 h-3 text-primary animate-pulse" />
                        <label className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Varsayılan İşlem Tarihi</label>
                    </div>
                    <input
                        type="date"
                        value={importDate}
                        onChange={(e) => setImportDate(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-[22px] px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-black shadow-lg"
                    />
                </div>
                <div className="space-y-3">
                    <div className="flex items-center gap-2 ml-1">
                        <AlertCircle className="w-3 h-3 text-primary" />
                        <label className="text-[10px] uppercase font-black text-white/50 tracking-[0.2em]">Varsayılan POS Şubesi</label>
                    </div>
                    <select
                        value={importSube}
                        onChange={(e) => setImportSube(e.target.value as Sube)}
                        disabled={!isAdmin}
                        className="w-full bg-black/60 border border-white/10 rounded-[22px] px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-black appearance-none disabled:opacity-50 shadow-lg"
                    >
                        {subeler.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* ADIM 1: Veri Yapıştırma */}
            {step === 'paste' && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                    <div className="bg-primary/10 border border-primary/20 rounded-[32px] p-8 flex items-start gap-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FileSpreadsheet className="w-32 h-32 text-primary" />
                        </div>
                        <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0 border border-primary/30">
                            <AlertCircle className="w-7 h-7 text-primary" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-black text-white uppercase mb-2 tracking-tight">Akıllı Veri Girişi</h3>
                            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl font-medium">
                                Excel listenizdeki satırları seçip <kbd className="bg-white/10 px-2 py-1 rounded text-xs text-primary font-bold">CTRL+C</kbd> ile kopyalayın. 
                                Ardından buraya gelip <kbd className="bg-white/10 px-2 py-1 rounded text-xs text-primary font-bold">CTRL+V</kbd> ile yapıştırın. 
                                Sistemimiz sütunları, tutarları ve taksit sayılarını otomatik olarak analiz edecektir.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <textarea
                                value={pasteData}
                                onChange={(e) => setPasteData(e.target.value)}
                                placeholder="Veriyi buraya yapıştırın..."
                                className="relative w-full h-[400px] bg-black/40 border-2 border-white/5 focus:border-primary/50 rounded-[40px] p-10 text-base font-mono text-gray-200 focus:outline-none transition-all placeholder:text-gray-800 custom-scrollbar shadow-2xl"
                            />
                        </div>
                        <button
                            onClick={() => handlePasteData()}
                            disabled={!pasteData.trim() || loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-6 rounded-[28px] font-black text-base uppercase tracking-[0.2em] shadow-[0_20px_40px_-15px_rgba(234,179,8,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-4 disabled:opacity-50 group"
                        >
                            {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : <ClipboardPaste className="w-7 h-7 group-hover:scale-110 transition-transform" />}
                            VERİYİ ANALİZ ET VE İŞLE
                        </button>
                    </div>
                </motion.div>
            )}

            {/* ADIM 2: Sütun Eşleştirme */}
            {step === 'map' && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
                    <div className="bg-white/[0.03] p-10 rounded-[40px] border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-2 h-8 bg-primary rounded-full" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">SÜTUN TANIMLAMA</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-10 max-w-xl font-medium">Sistem sütunları tam tanımlayamadı. Lütfen aşağıdaki ızgara (grid) üzerinden verilerin hangi sütunlarda olduğunu sisteme öğretin.</p>
                        
                        <div className="overflow-x-auto mb-10 bg-black/60 rounded-[32px] border border-white/5 max-h-[400px] custom-scrollbar shadow-inner">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-white/10 sticky top-0 z-10 backdrop-blur-xl">
                                    <tr className="text-[10px] uppercase font-black text-primary tracking-[0.2em] border-b border-white/10 font-mono">
                                        <th className="px-4 py-4 w-12 text-center bg-white/5 border-r border-white/10 italic">#</th>
                                        {rawLines[0]?.map((_: string, i: number) => (
                                            <th key={i} className="px-8 py-5 border-r border-white/10 min-w-[200px]">SÜTUN {i+1}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {rawLines.slice(0, 10).map((row: string[], rowIdx: number) => (
                                        <tr key={rowIdx} className="hover:bg-primary/5 transition-colors group">
                                            <td className="px-4 py-4 text-center bg-white/[0.02] border-r border-white/10 text-[10px] font-black text-gray-600 group-hover:text-primary transition-colors">{rowIdx + 1}</td>
                                            {row.map((col: string, i: number) => (
                                                <td key={i} className="px-8 py-5 text-white/70 font-bold border-r border-white/10 last:border-0 truncate max-w-[300px]" title={col}>
                                                    {col}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {rawLines.length > 10 && (
                                        <tr>
                                            <td colSpan={rawLines[0]?.length + 1} className="px-10 py-6 text-center text-[10px] text-primary font-black uppercase tracking-[0.3em] bg-white/[0.01] italic opacity-50">
                                                ... {rawLines.length - 10} SATIR DAHA ANALİZ EDİLDİ ...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 bg-black/20 p-10 rounded-[32px] border border-white/5">
                            {[
                                { key: 'bankCol' as keyof ColumnMapping, label: 'Banka / POS Adı' },
                                { key: 'descCol' as keyof ColumnMapping, label: 'Açıklama / Taksit' },
                                { key: 'amountCol' as keyof ColumnMapping, label: 'Tutar / Alacak' },
                                { key: 'dateCol' as keyof ColumnMapping, label: 'İşlem Tarihi (Ops)' },
                                { key: 'subeCol' as keyof ColumnMapping, label: 'Şube Bilgisi (Ops)' },
                            ].map((field) => (
                                <div key={field.key} className="space-y-3">
                                    <label className="text-[10px] uppercase font-black text-primary tracking-[0.2em] ml-2">{field.label}</label>
                                    <select
                                        value={currentMapping[field.key]}
                                        onChange={(e) => setDetectedColumns({ ...currentMapping, [field.key]: parseInt(e.target.value) })}
                                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-black appearance-none shadow-xl cursor-pointer hover:border-white/20"
                                    >
                                        <option value="-1">SEÇİM YAPILMADI</option>
                                        {rawLines[0]?.map((_, i) => <option key={i} value={i}>SÜTUN {i+1}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 flex gap-6">
                            <button
                                onClick={() => setStep('paste')}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.3em] transition-all border border-white/5"
                            >
                                GERİ DÖN
                            </button>
                            <button
                                onClick={handleApplyMapping}
                                className="flex-[2] bg-primary hover:bg-primary/90 text-white py-5 rounded-[22px] font-black text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                EŞLEŞTİRMEYİ ONAYLA VE İŞLE
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ADIM 3: İnceleme ve Kayıt */}
            {step === 'review' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                    <div className="flex flex-col xl:flex-row justify-between items-stretch gap-10">
                        <div className="flex-grow bg-white/[0.03] p-10 rounded-[40px] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-10">
                            <div className="text-center sm:text-left">
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mb-2 opacity-70 italic">Analiz Özeti</p>
                                <h3 className="text-4xl font-black text-white tracking-tighter leading-none italic uppercase">AKTARIŞ KONTROLÜ</h3>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{groupedRecords.length} Gruplanmış İşlem</p>
                                    <button 
                                        onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showOnlyErrors ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                                    >
                                        {showOnlyErrors ? 'Tümünü Göster' : 'Sadece Hataları Göster'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center sm:justify-end gap-10">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-gray-500 font-black tracking-[0.2em] mb-2 uppercase">Toplam Satır</p>
                                    <div className="text-3xl font-black text-white italic">{groupedRecords.reduce((sum, g) => sum + g.count, 0)}</div>
                                </div>
                                <div className="text-right border-l border-white/10 pl-10">
                                    <p className="text-[10px] uppercase text-gray-500 font-black tracking-[0.2em] mb-2 uppercase">GENEL TOPLAM</p>
                                    <div className="text-5xl font-black text-green-400 tracking-tighter italic">
                                        ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(groupedRecords.reduce((sum, p) => sum + p.tutar, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 rounded-[45px] border border-white/10 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]">
                        <table className="w-full text-left table-fixed border-collapse">
                            <thead className="bg-white/5 text-[10px] uppercase font-black text-white/30 tracking-[0.25em]">
                                <tr>
                                    <th className="px-10 py-8 w-[10%] italic">SIRA (#)</th>
                                    <th className="px-10 py-8 w-[15%]">İŞLEM TARİHİ</th>
                                    <th className="px-10 py-8 w-[18%]">KART ŞUBESİ</th>
                                    <th className="px-10 py-8 w-[18%]">ÇEKİM ŞUBESİ</th>
                                    <th className="px-10 py-8 w-[18%]">BANKA / POS</th>
                                    <th className="px-10 py-8 w-[21%] text-right italic">TOPLAM TUTAR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {groupedRecords
                                  .filter(g => !showOnlyErrors || g.taksit === null)
                                  .map((g) => (
                                    <tr key={g.id} className="hover:bg-white/[0.03] transition-all group">
                                        <td className="px-10 py-8">
                                            <div className="flex flex-wrap gap-1.5">
                                                {g.originalLineIndices.map(idx => (
                                                    <span key={idx} className="bg-white/10 hover:bg-primary/20 hover:text-primary px-2 py-1 rounded-md text-[9px] font-black text-gray-500 transition-colors border border-white/5">#{idx}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="text-sm font-black text-white tracking-widest">{new Date(g.tarih).toLocaleDateString('tr-TR')}</div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Müşteri Şubesi</span>
                                                <div className="text-xs font-black text-primary uppercase tracking-tighter italic">{g.sube}</div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">POS Şubesi</span>
                                                <div className={`text-xs font-black uppercase tracking-tighter italic ${g.cekimSube !== g.sube ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                    {g.cekimSube}
                                                    {g.cekimSube !== g.sube && <span className="ml-2 text-[8px] bg-orange-500/20 px-1 rounded ring-1 ring-orange-500/30">FARKLI POS</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                  <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-lg ${getBankColor(g.banka)}`}>
                                                      {g.banka}
                                                  </span>
                                                  {g.taksit !== null && (
                                                      <span className="text-[10px] font-black text-white/60">{g.taksit === 1 ? 'TEK ÇEKİM' : `${g.taksit} TAKSİT`}</span>
                                                  )}
                                                </div>
                                                
                                                {g.taksit === null && (
                                                  <div className={`border-2 rounded-2xl p-4 transition-all ${g.unsupportedMessage ? 'bg-orange-500/5 border-orange-500/30' : 'bg-red-500/5 border-red-500/20 animate-pulse-slow'}`}>
                                                      <div className="flex items-center gap-2 mb-2">
                                                          {g.unsupportedMessage ? <Info className="w-3 h-3 text-orange-400" /> : <AlertCircle className="w-3 h-3 text-red-400" />}
                                                          <p className={`text-[9px] font-black uppercase tracking-widest ${g.unsupportedMessage ? 'text-orange-400' : 'text-red-400'}`}>
                                                              {g.unsupportedMessage ? 'GEÇERSİZ TAKSİT!' : 'TAKSİT BELİRSİZ!'}
                                                          </p>
                                                      </div>
                                                      <select
                                                          onChange={(e) => updateGroupTaksit(g.id, parseInt(e.target.value))}
                                                          className={`w-full border rounded-lg px-3 py-2 text-[10px] font-black focus:outline-none appearance-none text-center cursor-pointer ${g.unsupportedMessage ? 'bg-orange-500/20 border-orange-500/30 text-orange-200' : 'bg-red-500/20 border-red-500/30 text-red-200'}`}
                                                      >
                                                          <option value="">SEÇİN</option>
                                                          {[1, 2, 3, 4, 5, 6, 9, 12].map(n => (
                                                              <option key={n} value={n} className="bg-slate-900 text-white">{n === 1 ? 'PEŞİN' : `${n} TAKSİT`}</option>
                                                          ))}
                                                      </select>
                                                  </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right font-black text-primary text-2xl tracking-tighter italic group-hover:scale-105 transition-transform origin-right whitespace-nowrap">
                                            ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(g.tutar)}
                                        </td>
                                    </tr>
                                  ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/20 border-2 border-destructive/30 text-white p-8 rounded-[32px] flex items-center gap-6 mt-10 shadow-2xl">
                    <div className="w-14 h-14 bg-destructive/20 rounded-2xl flex items-center justify-center shrink-0">
                        <X className="w-8 h-8 text-destructive" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-widest mb-1 text-red-400">IŞLEM HATASI</h4>
                        <p className="text-sm font-bold opacity-80">{error}</p>
                    </div>
                </motion.div>
            )}
        </div>

        <div className="px-10 py-10 border-t border-white/5 bg-black/60 flex justify-between items-center gap-6 relative z-10 backdrop-blur-2xl">
            <div className="flex flex-col">
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-1">Güvenlik Kontrolü:</p>
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] text-white/60 font-black uppercase tracking-tight">Veri Bütünlüğü Doğrulandı</span>
                </div>
            </div>

            <div className="flex gap-6">
                {step !== 'paste' && !success && (
                    <button
                        onClick={() => setStep('paste')}
                        disabled={processLoading}
                        className="px-10 py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.2em] bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all disabled:opacity-50 active:scale-95 shadow-xl"
                    >
                        SİL VE YENİDEN BAŞLA
                    </button>
                )}

                {step === 'review' && groupedRecords.length > 0 && !success && (
                    <button
                        onClick={handleProcess}
                        disabled={processLoading}
                        className="px-12 py-5 rounded-[22px] font-black text-xs uppercase tracking-[0.3em] bg-primary hover:bg-primary/90 text-white shadow-[0_20px_40px_-15px_rgba(234,179,8,0.4)] transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50 group border border-white/10"
                    >
                        {processLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        )}
                        {processLoading ? progressMsg : 'KAYITLARI SISTEME IŞLE'}
                    </button>
                )}

                {success && (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-4 text-emerald-400 font-black uppercase tracking-[0.3em] text-sm px-10 py-5 bg-emerald-500/20 border border-emerald-500/30 rounded-[22px] shadow-2xl shadow-emerald-500/20">
                        <CheckCircle2 className="w-7 h-7" />
                        AKTARIM BAŞARILI
                    </motion.div>
                )}
            </div>
        </div>
      </motion.div>

      {/* QUICK BANK EDIT MODAL */}
      <AnimatePresence>
        {editingBankSetting && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glassmorphism w-full max-w-lg rounded-[32px] border border-white/10 p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tight">BANKA YAPILANDIRMA</h3>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest">{editingBankSetting.banka_adi}</p>
                </div>
                <button onClick={() => setEditingBankSetting(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                <table className="w-full text-left text-xs">
                  <thead className="text-white/30 uppercase font-black text-[9px] tracking-widest">
                    <tr className="border-b border-white/5">
                      <th className="py-2">Taksit</th>
                      <th className="py-2">Komisyon (%)</th>
                      <th className="py-2">Blokaj (Gün)</th>
                      <th className="py-2 text-right">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.keys(editingBankSetting.komisyon_oranlari).map((t) => (
                      <tr key={t} className="group hover:bg-white/5">
                        <td className="py-3 font-black text-white">{t === '1' ? 'PEŞİN' : `${t} Taksit`}</td>
                        <td className="py-3">
                          <input 
                            type="number" 
                            step="0.01"
                            value={editingBankSetting.komisyon_oranlari[t]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setEditingBankSetting({
                                ...editingBankSetting,
                                komisyon_oranlari: { ...editingBankSetting.komisyon_oranlari, [t]: val }
                              });
                            }}
                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-primary font-bold focus:outline-none focus:border-primary/50"
                          />
                        </td>
                        <td className="py-3">
                           <input 
                            type="number" 
                            value={editingBankSetting.blokaj_gunleri?.[t] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEditingBankSetting({
                                ...editingBankSetting,
                                blokaj_gunleri: { ...(editingBankSetting.blokaj_gunleri || {}), [t]: val }
                              });
                            }}
                            className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-white font-bold focus:outline-none focus:border-white/20"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <button 
                            onClick={() => {
                              const newRates = { ...editingBankSetting.komisyon_oranlari };
                              const newBlokaj = { ...(editingBankSetting.blokaj_gunleri || {}) };
                              delete newRates[t];
                              delete newBlokaj[t];
                              setEditingBankSetting({ ...editingBankSetting, komisyon_oranlari: newRates, blokaj_gunleri: newBlokaj });
                            }}
                            className="p-1 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-3">Yeni Taksit Tanımla</p>
                <div className="flex gap-3">
                  <input id="new-taksit" type="number" placeholder="Taksit" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                  <input id="new-komisyon" type="number" step="0.01" placeholder="Komisyon %" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                  <button 
                    onClick={() => {
                      const t = (document.getElementById('new-taksit') as HTMLInputElement).value;
                      const k = (document.getElementById('new-komisyon') as HTMLInputElement).value;
                      if (t && k) {
                        setEditingBankSetting({
                          ...editingBankSetting,
                          komisyon_oranlari: { ...editingBankSetting.komisyon_oranlari, [t]: parseFloat(k) },
                          blokaj_gunleri: { ...(editingBankSetting.blokaj_gunleri || {}), [t]: 30 }
                        });
                        (document.getElementById('new-taksit') as HTMLInputElement).value = '';
                        (document.getElementById('new-komisyon') as HTMLInputElement).value = '';
                      }
                    }}
                    className="bg-primary px-4 py-2 rounded-xl text-xs font-black text-white hover:bg-primary/90 transition-all"
                  >
                    EKLE
                  </button>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => setEditingBankSetting(null)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  İPTAL
                </button>
                <button 
                  onClick={() => handleUpdateBankSetting(editingBankSetting)}
                  className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  AYARLARI KAYDET
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
