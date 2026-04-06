import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Sube } from '../../types';
import { Loader2, X, CheckCircle2, AlertCircle, FileSpreadsheet, ClipboardPaste } from 'lucide-react';
import { motion } from 'framer-motion';
import { generatePaymentSchedule } from '../../utils/paymentCalculator';
import { logAction } from '../../utils/logger';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSube: Sube;
}

interface GroupedData {
  id: string; 
  banka: string;
  taksit: number;
  tutar: number;
  count: number;
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

  if (!isOpen) return null;

  const isAdmin = user?.user_metadata?.role === 'admin';
  const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

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
    return 'NAKİT'; 
  };

  const extractInstallment = (aciklama: string) => {
    const match = aciklama.toUpperCase().match(/(\d+)\s*(TKS|TAKSİT|TAKSIT)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 1;
  };

  const handlePasteData = () => {
    if (!pasteData.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const lines = pasteData.split('\n').filter(l => l.trim());
      if (lines.length === 0) throw new Error('Geçerli bir veri bulunamadı.');

      // Header detection
      let bankCol = -1, descCol = -1, amountCol = -1;
      
      // Look at the first row to see if it's a header
      const firstLineCols = lines[0].split('\t').map(c => c.trim().toUpperCase());
      firstLineCols.forEach((col, idx) => {
        if (col === 'BANKA HESAP ADI' || (col.includes('BANKA') && col.includes('ADI'))) bankCol = idx;
        if (col === 'AÇIKLAMA' || col.includes('ACIKLAMA')) descCol = idx;
        // Match "ALACAK" but NOT "DÖVİZ ALACAK"
        if ((col === 'ALACAK' || col.includes('TUTAR')) && !col.includes('DÖVİZ')) amountCol = idx;
      });

      // Start processing from row 0 if no header found, or row 1 if header found
      const startIdx = (bankCol !== -1 && amountCol !== -1) ? 1 : 0;
      
      // Fallback to indices if headers not detected (Based on user screenshot: 3, 4, 5)
      if (bankCol === -1) bankCol = 3;
      if (descCol === -1) descCol = 4;
      if (amountCol === -1) amountCol = 5;

      const groups: Record<string, GroupedData> = {};

      for (let i = startIdx; i < lines.length; i++) {
        const columns = lines[i].split('\t');
        if (columns.length <= Math.max(bankCol, descCol, amountCol)) continue;

        const bankaMetni = columns[bankCol]?.trim() || '';
        const aciklamaMetni = columns[descCol]?.trim() || '';
        const tutarMetni = columns[amountCol]?.trim() || '0';
        
        // Cleanup amount: Handle "15.722,00" or "15722" formats
        const tutar = parseFloat(tutarMetni.replace(/\./g, '').replace(',', '.'));

        if (bankaMetni && !isNaN(tutar) && tutar > 0) {
          const bankaEnum = getBankEnum(bankaMetni);
          const taksit = extractInstallment(aciklamaMetni);
          const key = `${bankaEnum}_${taksit}`;

          if (!groups[key]) {
            groups[key] = { id: key, banka: bankaEnum, taksit, tutar: 0, count: 0 };
          }
          groups[key].tutar += tutar;
          groups[key].count += 1;
        }
      }

      const result = Object.values(groups).sort((a, b) => b.tutar - a.tutar);
      if (result.length === 0) {
        throw new Error('Veri ayrıştırılamadı. Lütfen direkt Excel tablosundan kopyaladığınızdan (Banka, Açıklama ve Alacak sütunlarını içerdiğinden) emin olun.');
      }

      setGroupedRecords(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (processLoading || groupedRecords.length === 0) return;

    setProcessLoading(true);
    setError(null);
    setProgressMsg('Kayıtlar işleniyor...');

    try {
      if (!importDate) throw new Error('Lütfen geçerli bir tarih seçin.');

      const { data: bSettings } = await supabase.from('banka_ayarlari').select('*');
      const { data: holData } = await supabase.from('tatil_gunleri').select('tarih');
      const holidaysList = (holData || []).map(h => h.tarih);

      for (const group of groupedRecords) {
        let bankSetting = bSettings?.sort((a, b) => new Date(b.baslangic_tarihi).getTime() - new Date(a.baslangic_tarihi).getTime())
          .find(s => s.banka_adi === group.banka && new Date(s.baslangic_tarihi) <= new Date(importDate));
        
        if (!bankSetting) {
            bankSetting = bSettings?.find(s => s.banka_adi === group.banka) || {
                banka_adi: group.banka, vade_gun: 30, komisyon_oranlari: { [group.taksit]: 0 }
            };
        }

        const musteriAdi = `${group.banka.split(' ')[0]} ${group.taksit} TAKSİT TOPLU`;
        const { data: newRecord, error: insertErr } = await supabase.from('kayitlar').insert({
          tarih: importDate, musteri_adi: musteriAdi, banka: group.banka, 
          cekim_subesi: importSube, sube_adi: importSube,
          tutar: group.tutar, taksit: group.taksit, user_id: user?.id,
          notlar: `Excel'den Kopyala-Yapıştır (${group.count} işlem)`
        }).select('id').single();

        if (!insertErr && group.banka.includes('POS')) {
            const plan = generatePaymentSchedule(
                { tarih: importDate, tutar: group.tutar, taksit: group.taksit, banka: group.banka },
                bankSetting, holidaysList
            );
            await supabase.from('odeme_plani').insert(plan.map(p => ({
                kayit_id: newRecord.id, taksit_no: p.taksit_no, planlanan_tarih: p.planlanan_tarih,
                net_tutar: p.net_tutar, komisyon_tutar: p.komisyon_tutar, ana_tutar: p.ana_tutar, durum: 'BEKLEMEDE'
            })));
        }
      }
      
      setGroupedRecords([]); // Mükerrer kaydı önlemek için listeyi hemen temizle

      // AUDIT LOG: İşlem tamamlandığında detaylı kayıt tut
      await logAction({
        userId: user?.id || '',
        subeAdi: importSube,
        action: 'TOPLU_AKTARIM',
        details: {
          tarih: importDate,
          toplam_tutar: groupedRecords.reduce((sum, g) => sum + g.tutar, 0),
          grup_adedi: groupedRecords.length,
          toplam_satir: groupedRecords.reduce((sum, g) => sum + g.count, 0),
          bankalar: groupedRecords.map(g => `${g.banka} (${g.taksit} TKS)`)
        }
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
       const msg = err.message || 'Bilinmeyen bir hata';
       setError(`Aktarım Durduruldu: ${msg}. Lütfen bu bankanın ayarlarını kontrol edin.`);
    } finally {
      setProcessLoading(false);
    }
  };

  const getBankColor = (bankName: string) => {
    if (bankName.includes('DENİZ')) return 'text-blue-400 bg-blue-500/10';
    if (bankName.includes('FİNANS')) return 'text-purple-400 bg-purple-500/10';
    if (bankName.includes('YAPI KREDİ')) return 'text-indigo-400 bg-indigo-500/10';
    if (bankName.includes('ZİRAAT')) return 'text-red-400 bg-red-500/10';
    if (bankName.includes('KUVEYT')) return 'text-yellow-500 bg-yellow-600/10';
    return 'text-slate-400 bg-slate-500/10';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glassmorphism w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/10 relative"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <ClipboardPaste className="w-6 h-6 text-primary" />
             </div>
             <div>
               <h2 className="text-xl font-black text-white tracking-tight uppercase">Excel'den Hızlı Aktarım</h2>
               <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Kopyala-Yapıştır ile Toplu Kayıt</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all transform hover:rotate-90" disabled={processLoading}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            {/* HER ZAMAN GÖRÜNÜR: Tarih ve Şube Seçimi */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-primary tracking-widest ml-1">İşlem Tarihi</label>
                    <input
                        type="date"
                        value={importDate}
                        onChange={(e) => setImportDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-primary tracking-widest ml-1">Çekim Şubesi</label>
                    <select
                        value={importSube}
                        onChange={(e) => setImportSube(e.target.value as Sube)}
                        disabled={!isAdmin}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-bold appearance-none disabled:opacity-50"
                    >
                        {subeler.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {!groupedRecords.length ? (
                <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-black text-white uppercase mb-1 tracking-wider">Nasıl Kullanılır?</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Excel tablonuzdan dilediğiniz satırları seçip <b>Ctrl+C</b> ile kopyalayın. 
                                Ardından aşağıdaki alana <b>Ctrl+V</b> ile yapıştırın ve "Çözümle" butonuna basın.
                                <span className="block mt-2 text-[10px] text-primary font-bold">Önemli: Müşteri isimleri atlanır, sadece Banka ve Taksit toplamları işlenir.</span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <textarea
                                value={pasteData}
                                onChange={(e) => setPasteData(e.target.value)}
                                placeholder="Excel verisini buraya yapıştırın..."
                                className="w-full h-80 bg-black/40 border-2 border-white/5 focus:border-primary/50 rounded-3xl p-6 text-sm font-mono text-gray-300 focus:outline-none transition-all placeholder:text-gray-700 custom-scrollbar"
                            />
                        </div>
                        <button
                            onClick={handlePasteData}
                            disabled={!pasteData.trim() || loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileSpreadsheet className="w-6 h-6" />}
                            Veriyi Çözümle ve Grupla
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-white/5 p-6 rounded-3xl border border-white/10">
                        <div className="text-center sm:text-left">
                            <h3 className="text-2xl font-black text-white tracking-tighter">GRUP ÖZETİ</h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Aynı banka ve taksitler birleştirildi</p>
                        </div>
                        <div className="flex gap-8">
                            <div className="text-right">
                                <div className="text-[10px] uppercase text-gray-500 font-black tracking-widest">KALEM</div>
                                <div className="text-2xl font-black text-white">{groupedRecords.length}</div>
                            </div>
                            <div className="text-right border-l border-white/10 pl-8">
                                <div className="text-[10px] uppercase text-gray-500 font-black tracking-widest">TOPLAM TUTAR</div>
                                <div className="text-3xl font-black text-green-400 tracking-tighter">₺{new Intl.NumberFormat('tr-TR').format(groupedRecords.reduce((sum, p) => sum + p.tutar, 0))}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                        <table className="w-full text-sm text-left table-fixed">
                            <thead className="bg-white/5 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                                <tr>
                                    <th className="px-6 py-5 w-[30%]">Kayıt Adı</th>
                                    <th className="px-6 py-5 w-[25%]">Banka Türü</th>
                                    <th className="px-6 py-5 w-[15%] text-center">Taksit</th>
                                    <th className="px-6 py-5 w-[15%] text-center">İşlem</th>
                                    <th className="px-6 py-5 w-[15%] text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {groupedRecords.map((g) => (
                                    <tr key={g.id} className="hover:bg-white/5 transition-all">
                                        <td className="px-6 py-5">
                                            <div className="font-black text-white text-sm truncate" title={`${g.banka.split(' ')[0]} ${g.taksit} TAKSİT TOPLU`}>
                                                {g.banka.split(' ')[0]} {g.taksit} TAKSİT TOPLU
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter whitespace-nowrap ${getBankColor(g.banka)}`}>
                                                {g.banka}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex items-center justify-center bg-primary/20 text-primary px-2.5 py-1 rounded-lg text-[10px] font-black">
                                                {g.taksit} TKS
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center text-gray-300 font-bold text-xs">{g.count} Satır</td>
                                        <td className="px-6 py-5 text-right font-black text-primary text-lg tracking-tighter whitespace-nowrap">
                                            ₺{new Intl.NumberFormat('tr-TR').format(g.tutar)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-5 rounded-2xl flex items-center gap-4 mt-6 animate-shake">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
                </div>
            )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/40 flex justify-end items-center gap-4">
            {groupedRecords.length > 0 && !success && (
                <button
                    onClick={() => setGroupedRecords([])}
                    disabled={processLoading}
                    className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all disabled:opacity-50"
                >
                    İptal / Geri Dön
                </button>
            )}

            {groupedRecords.length > 0 && !success && (
                <button
                    onClick={handleProcess}
                    disabled={processLoading}
                    className="px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                    {processLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-5 h-5" />
                    )}
                    {processLoading ? progressMsg : 'Kaydı Sisteme İşle'}
                </button>
            )}

            {success && (
                <div className="flex items-center gap-3 text-green-400 font-black uppercase tracking-widest text-sm animate-bounce px-6 py-4 bg-green-500/10 rounded-2xl">
                    <CheckCircle2 className="w-6 h-6" />
                    Başarıyla Aktarıldı
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
