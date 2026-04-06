import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { BankSettings, BankHoliday, PaymentPlanItem, Kayit } from '../types';
import MainLayout from '../components/layout/MainLayout';
import { 
  Building2, 
  Calendar, 
  Table as TableIcon, 
  Save, 
  CalendarClock, 
  Info,
  Loader2,
  RefreshCw,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Download,
  CheckCircle,
  Clock,
  PieChart,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  startOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  isSameDay,
  addMonths 
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function AdminPayments() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'banks' | 'holidays' | 'schedule' | 'analysis'>('schedule');
  const [banks, setBanks] = useState<BankSettings[]>([]);
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [schedule, setSchedule] = useState<PaymentPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentPlanItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('all');
  const [subeFilter, setSubeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof PaymentPlanItem | 'sube' | 'banka'; direction: 'asc' | 'desc' }>({ key: 'planlanan_tarih', direction: 'asc' });
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [expandedBank, setExpandedBank] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'banks') {
        const { data, error } = await supabase.from('banka_ayarlari').select('*').order('banka_adi');
        if (error) throw error;
        setBanks(data || []);
      } else if (activeTab === 'holidays') {
        const { data, error } = await supabase.from('tatil_gunleri').select('*').order('tarih');
        if (error) throw error;
        setHolidays(data || []);
      } else if (activeTab === 'schedule') {
        const { data, error } = await supabase
          .from('odeme_plani')
          .select('*, kayitlar(*)')
          .order('planlanan_tarih', { ascending: true });
        if (error) throw error;
        setSchedule(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { filteredSchedule, stats, dailySummaries, chartData, bankEfficiency } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    const monthRange = { start: startOfMonth(now), end: endOfMonth(now) };

    const initialStats = {
      today: { net: 0, gross: 0, comm: 0 },
      week: { net: 0, gross: 0, comm: 0 },
      month: { net: 0, gross: 0, comm: 0 },
      received: { net: 0, count: 0 },
      pending: { net: 0, count: 0 },
      filteredTotal: { net: 0, gross: 0, comm: 0, count: 0 }
    };

    const dailyMap: Record<string, { date: string, net: number, gross: number, comm: number, banks: Record<string, number> }> = {};
    const chartMap: Record<string, { month: string, net: number, gross: number }> = {};
    const efficiencyMap: Record<string, { name: string, totalGross: number, totalComm: number, count: number }> = {};

    // Initialize 12 months for chart
    for (let i = -1; i < 11; i++) {
        const d = addMonths(startOfMonth(now), i);
        const k = format(d, 'yyyy-MM');
        chartMap[k] = { month: format(d, 'MMM yy', { locale: tr }), net: 0, gross: 0 };
    }

    const filtered = schedule.filter(item => {
      const itemDate = parseISO(item.planlanan_tarih);
      
      // 1. Global Stats
      if (item.durum === 'YATTI') {
          initialStats.received.net += item.net_tutar;
          initialStats.received.count++;
      } else {
          initialStats.pending.net += item.net_tutar;
          initialStats.pending.count++;
      }

      if (isSameDay(itemDate, today)) {
        initialStats.today.net += item.net_tutar;
        initialStats.today.gross += item.ana_tutar;
        initialStats.today.comm += item.komisyon_tutar;
      }
      if (isWithinInterval(itemDate, weekRange)) {
        initialStats.week.net += item.net_tutar;
        initialStats.week.gross += item.ana_tutar;
        initialStats.week.comm += item.komisyon_tutar;
      }
      if (isWithinInterval(itemDate, monthRange)) {
        initialStats.month.net += item.net_tutar;
        initialStats.month.gross += item.ana_tutar;
        initialStats.month.comm += item.komisyon_tutar;
      }

      // Chart stats
      const cKey = format(itemDate, 'yyyy-MM');
      if (chartMap[cKey]) {
          chartMap[cKey].net += item.net_tutar;
          chartMap[cKey].gross += item.ana_tutar;
      }

      // 2. Filters
      const matchesSearch = item.kayitlar?.musteri_adi?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBank = bankFilter === 'all' || item.kayitlar?.banka === bankFilter;
      const matchesSube = subeFilter === 'all' || item.kayitlar?.sube_adi === subeFilter;
      
      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && item.planlanan_tarih >= startDate;
      if (endDate) matchesDate = matchesDate && item.planlanan_tarih <= endDate;

      const isIncluded = matchesSearch && matchesBank && matchesSube && matchesDate;

      if (isIncluded) {
        initialStats.filteredTotal.net += item.net_tutar;
        initialStats.filteredTotal.gross += item.ana_tutar;
        initialStats.filteredTotal.comm += item.komisyon_tutar;
        initialStats.filteredTotal.count++;

        // Grouping for Daily Analysis
        const dKey = item.planlanan_tarih;
        if (!dailyMap[dKey]) {
          dailyMap[dKey] = { date: dKey, net: 0, gross: 0, comm: 0, banks: {} };
        }
        dailyMap[dKey].net += item.net_tutar;
        dailyMap[dKey].gross += item.ana_tutar;
        dailyMap[dKey].comm += item.komisyon_tutar;
        const bName = item.kayitlar?.banka || 'Bilinmiyor';
        dailyMap[dKey].banks[bName] = (dailyMap[dKey].banks[bName] || 0) + item.net_tutar;

        // Efficiency tracking
        if (!efficiencyMap[bName]) {
            efficiencyMap[bName] = { name: bName, totalGross: 0, totalComm: 0, count: 0 };
        }
        efficiencyMap[bName].totalGross += item.ana_tutar;
        efficiencyMap[bName].totalComm += item.komisyon_tutar;
        efficiencyMap[bName].count++;
      }

      return isIncluded;
    });

    // Sort filtered results
    filtered.sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;
      if (sortConfig.key === 'sube') {
        aValue = a.kayitlar?.sube_adi;
        bValue = b.kayitlar?.sube_adi;
      } else if (sortConfig.key === 'banka') {
        aValue = a.kayitlar?.banka;
        bValue = b.kayitlar?.banka;
      } else {
        aValue = a[sortConfig.key as keyof PaymentPlanItem] as string | number | undefined;
        bValue = b[sortConfig.key as keyof PaymentPlanItem] as string | number | undefined;
      }

      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    const dailySummaries = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const chartData = Object.values(chartMap).sort((a, b) => a.month.localeCompare(b.month));
    const bankEfficiency = Object.values(efficiencyMap).sort((a, b) => b.totalGross - a.totalGross);

    return { filteredSchedule: filtered, stats: initialStats, dailySummaries, chartData, bankEfficiency };
  }, [schedule, searchTerm, bankFilter, subeFilter, startDate, endDate, sortConfig]);

  const requestSort = (key: keyof PaymentPlanItem | 'sube' | 'banka') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // fetchData was moved above

  const handleUpdateBank = async (bank: BankSettings) => {
    if (!bank.id) return;
    setSaving(bank.id);
    try {
      const { error } = await supabase
        .from('banka_ayarlari')
        .update({
          vade_gun: bank.vade_gun,
          komisyon_oranlari: bank.komisyon_oranlari,
          blokaj_gunleri: bank.blokaj_gunleri || {},
          is_active: bank.is_active ?? true,
          holiday_calculation_active: bank.holiday_calculation_active ?? true,
          baslangic_tarihi: bank.baslangic_tarihi,
          bitis_tarihi: bank.bitis_tarihi || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bank.id);
      if (error) throw error;
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Hata: ' + message);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateNewAgreement = async (newAgreement: BankSettings) => {
    try {
        setLoading(true);
        // 1. Find the agreement that needs to be "closed"
        const { data: currentAgreements } = await supabase
            .from('banka_ayarlari')
            .select('*')
            .eq('banka_adi', newAgreement.banka_adi)
            .is('bitis_tarihi', null);
        
        if (currentAgreements && currentAgreements.length > 0) {
            const prev = currentAgreements[0];
            const oneDayBefore = new Date(new Date(newAgreement.baslangic_tarihi).getTime() - 86400000).toISOString().split('T')[0];
            
            await supabase
                .from('banka_ayarlari')
                .update({ bitis_tarihi: oneDayBefore })
                .eq('id', prev.id);
        }

        // 2. Insert new agreement
        const { error } = await supabase
            .from('banka_ayarlari')
            .insert([newAgreement]);
        
        if (error) throw error;
        
        fetchData();
        alert('Yeni anlaşma başarıyla oluşturuldu ve önceki anlaşma sonlandırıldı.');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Yeni anlaşma oluşturulamadı: ' + message);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteBank = async (bankName: string) => {
    if (!window.confirm(`${bankName} bankasına ait TÜM anlaşma ve ayarları silmek istediğinize emin misiniz?`)) return;
    try {
        setLoading(true);
        const { error } = await supabase
            .from('banka_ayarlari')
            .delete()
            .eq('banka_adi', bankName);
        if (error) throw error;
        fetchData();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Banka silinemedi: ' + message);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteAgreement = async (id: string) => {
    const agreementToDelete = banks.find(b => b.id === id);
    if (!agreementToDelete || !window.confirm('Bu anlaşma kaydını silmek istediğinize emin misiniz?')) return;

    try {
        setLoading(true);
        const bankName = agreementToDelete.banka_adi;

        // 1. Silme İşlemi
        const { error: deleteError } = await supabase
            .from('banka_ayarlari')
            .delete()
            .eq('id', id);
        if (deleteError) throw deleteError;

        // 2. Kalan anlaşmaları kontrol et ve en sonuncusunun bitiş tarihini aç
        const { data: remaining } = await supabase
            .from('banka_ayarlari')
            .select('*')
            .eq('banka_adi', bankName)
            .order('baslangic_tarihi', { ascending: false });

        if (remaining && remaining.length > 0) {
            // En güncel kalan anlaşmanın bitiş tarihini sil (Süresiz yap)
            const latest = remaining[0];
            await supabase
                .from('banka_ayarlari')
                .update({ bitis_tarihi: null })
                .eq('id', latest.id);
        }

        fetchData();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Anlaşma silinemedi: ' + message);
    } finally {
        setLoading(false);
    }
  };

  const handleAddNewBank = async () => {
    const bankName = window.prompt('Eklenecek Banka Adı (Örn: X BANK POS):');
    if (!bankName) return;

    const startDate = window.prompt(`${bankName} için ilk anlaşma başlangıç tarihini girin (YYYY-MM-DD):`, new Date().toISOString().split('T')[0]);
    if (!startDate) return;

    try {
        setLoading(true);
        const newBank: BankSettings = {
            banka_adi: bankName,
            baslangic_tarihi: startDate,
            bitis_tarihi: null,
            vade_gun: 30,
            komisyon_oranlari: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 },
            blokaj_gunleri: { '1': 30 },
            is_active: true,
            holiday_calculation_active: true
        };

        const { error } = await supabase
            .from('banka_ayarlari')
            .insert([newBank]);
        
        if (error) throw error;
        fetchData();
        alert(`${bankName} başarıyla eklendi.`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Banka eklenemedi: ' + message);
    } finally {
        setLoading(false);
    }
  };

  const handleToggleStatus = async (itemId: string, currentStatus: string) => {
    setStatusLoading(itemId);
    try {
      const newStatus = currentStatus === 'YATTI' ? 'BEKLEMEDE' : 'YATTI';
      const { error } = await supabase
        .from('odeme_plani')
        .update({ durum: newStatus })
        .eq('id', itemId);
      
      if (error) throw error;
      
      setSchedule(prev => prev.map(item => 
        item.id === itemId ? { ...item, durum: newStatus } : item
      ));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Hata: ' + message);
    } finally {
      setStatusLoading(null);
    }
  };

  const handleExportExcel = async (type: 'filtered' | 'all') => {
    try {
      const dataToExport = type === 'filtered' ? filteredSchedule : schedule;
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ödeme Planı');

      worksheet.columns = [
        { header: 'Tarih', key: 'tarih', width: 15 },
        { header: 'Şube', key: 'sube', width: 20 },
        { header: 'Müşteri', key: 'musteri', width: 25 },
        { header: 'Banka', key: 'banka', width: 20 },
        { header: 'Taksit', key: 'taksit', width: 10 },
        { header: 'Brüt Tutar', key: 'brut', width: 15 },
        { header: 'Komisyon', key: 'komisyon', width: 15 },
        { header: 'Net Tutar', key: 'net', width: 15 },
        { header: 'Durum', key: 'durum', width: 15 }
      ];

      // Header styling
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      dataToExport.forEach(item => {
        worksheet.addRow({
          tarih: format(parseISO(item.planlanan_tarih), 'dd.MM.yyyy'),
          sube: item.kayitlar?.sube_adi,
          musteri: item.kayitlar?.musteri_adi,
          banka: item.kayitlar?.banka,
          taksit: `${item.taksit_no}/${item.kayitlar?.taksit}`,
          brut: item.ana_tutar,
          komisyon: item.komisyon_tutar,
          net: item.net_tutar,
          durum: item.durum
        });
      });

      // Number formatting
      worksheet.getColumn('brut').numFmt = '#,##0.00 "₺"';
      worksheet.getColumn('komisyon').numFmt = '#,##0.00 "₺"';
      worksheet.getColumn('net').numFmt = '#,##0.00 "₺"';

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Odeme_Plani_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      setShowExportModal(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Excel dışa aktarma hatası: ' + message);
    }
  };

  const handleSyncRecords = async () => {
    const shouldOverwrite = window.confirm('Tüm POS kayıtları taranacak. Mevcut "BEKLEMEDE" olan planlar silinip GÜNCEL komisyonlarla yeniden oluşturulacak. (Ödenmiş/YATTI olan taksitler korunur). Devam edilsin mi?');
    if (!shouldOverwrite) return;
    
    setSyncing(true);
    try {
      // 1. Fetch all POS records
      const { data: posRecords, error: recError } = await supabase
        .from('kayitlar')
        .select('*')
        .ilike('banka', '%POS%');
      
      if (recError) throw recError;
      if (!posRecords || posRecords.length === 0) {
        alert('Taranacak POS kaydı bulunamadı.');
        return;
      }

      // 2. Fetch Bank Settings
      const { data: bankSettings, error: bankError } = await supabase.from('banka_ayarlari').select('*');
      if (bankError) throw bankError;

      // 3. Fetch Holidays
      const { data: holidaysData, error: holidayError } = await supabase.from('tatil_gunleri').select('tarih');
      if (holidayError) throw holidayError;
      const holidayList = holidaysData.map(h => h.tarih);

      // 4. Generate & Insert for each
      const { generatePaymentSchedule } = await import('../utils/paymentCalculator');
      
      let updatedCount = 0;
      let newCount = 0;

      for (const record of posRecords) {
        const settings = bankSettings.find(b => b.banka_adi === record.banka);
        if (!settings) continue;

        // Mevcut planı kontrol et
        const { data: existingPlan } = await supabase
          .from('odeme_plani')
          .select('*')
          .eq('kayit_id', record.id);
        
        const hasPaidInstallments = existingPlan?.some(i => i.durum === 'YATTI');

        if (hasPaidInstallments) {
            // Ödenmiş taksit varsa risk almamak için bu kaydı atla veya sadece bekleyenleri güncelle (şimdilik güvenli liman: atla)
            continue;
        }

        // Ödenmiş taksit yoksa, eskiyi sil ve yeniyi oluştur
        if (existingPlan && existingPlan.length > 0) {
            await supabase.from('odeme_plani').delete().eq('kayit_id', record.id);
            updatedCount++;
        } else {
            newCount++;
        }

        const schedule = generatePaymentSchedule(record as Kayit, settings, holidayList);
        const toInsert = schedule.map(s => ({
          kayit_id: record.id,
          taksit_no: s.taksit_no,
          planlanan_tarih: s.planlanan_tarih,
          net_tutar: s.net_tutar,
          komisyon_tutar: s.komisyon_tutar,
          ana_tutar: s.ana_tutar,
          durum: 'BEKLEMEDE'
        }));
        
        await supabase.from('odeme_plani').insert(toInsert);
      }

      alert(`${updatedCount} adet mevcut plan güncellendi, ${newCount} adet yeni plan oluşturuldu.`);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Senkronizasyon hatası: ' + message);
    } finally {
      setSyncing(false);
    }
  };

  if (user?.user_metadata?.role !== 'admin') {
     return <MainLayout><div className="p-20 text-center font-bold">Yetkisiz Erişim</div></MainLayout>;
  }

  return (
    <MainLayout>
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-lg overflow-hidden rounded-3xl border border-border shadow-2xl"
            >
              <div className="bg-muted/50 px-8 py-6 flex justify-between items-center border-b border-border">
                <div>
                  <h2 className="font-black text-foreground text-lg flex items-center gap-2">
                    <Info size={20} className="text-primary" /> Ödeme Detayları
                  </h2>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">İşlem ve Hesaplama Dökümü</p>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)} 
                  className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-primary block tracking-tighter opacity-70">Müşteri / Şube</label>
                    <p className="font-extrabold text-base text-foreground leading-tight">{selectedItem.kayitlar?.musteri_adi}</p>
                    <p className="text-xs font-medium text-muted-foreground">{selectedItem.kayitlar?.sube_adi} Şubesi</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-primary block tracking-tighter opacity-70">Banka ve Taksit</label>
                    <p className="font-extrabold text-base text-foreground uppercase leading-tight">{selectedItem.kayitlar?.banka}</p>
                    <p className="text-xs font-medium text-muted-foreground">{selectedItem.taksit_no}. Taksit / {selectedItem.kayitlar?.taksit}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                    <label className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">İşlem Tarihi</label>
                    <p className="font-bold text-sm text-foreground">
                      {selectedItem.kayitlar?.tarih ? format(parseISO(selectedItem.kayitlar.tarih), 'dd.MM.yyyy') : '-'}
                    </p>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <label className="text-[9px] uppercase font-bold text-primary block mb-1">Planlanan Yatış</label>
                    <p className="font-bold text-sm text-primary">
                      {format(parseISO(selectedItem.planlanan_tarih), 'dd MMMM yyyy', { locale: tr })}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-border">
                  <div className="flex justify-between items-center bg-muted/20 p-3 rounded-xl">
                    <span className="text-xs font-bold text-muted-foreground uppercase text-[9px]">Taksit Brüt Tutarı:</span>
                    <span className="font-bold text-base text-foreground">₺{selectedItem.ana_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] uppercase font-black text-primary block tracking-widest pl-2">Tüm Taksit Planı</label>
                     <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {schedule
                          .filter(s => s.kayit_id === selectedItem.kayit_id)
                          .sort((a, b) => a.taksit_no - b.taksit_no)
                          .map(inst => (
                             <div 
                               key={inst.id} 
                               className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${inst.id === selectedItem.id ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-muted/10 border-border/50'}`}
                             >
                                <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${inst.id === selectedItem.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                      {inst.taksit_no}
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black text-foreground">
                                         {format(parseISO(inst.planlanan_tarih), 'dd MMM yyyy', { locale: tr })}
                                      </p>
                                      <p className="text-[9px] text-muted-foreground font-bold uppercase">{format(parseISO(inst.planlanan_tarih), 'EEEE', { locale: tr })}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className="text-xs font-black text-primary">₺{inst.net_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                                   <p className="text-[9px] text-muted-foreground font-bold uppercase">NET</p>
                                </div>
                             </div>
                          ))
                        }
                     </div>
                  </div>

                  <div className="space-y-2 px-2 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Uygulanan Oran:</span>
                      <span className="font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded text-[10px]">
                        %{((selectedItem.komisyon_tutar / selectedItem.ana_tutar) * 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Bu Taksit Kesintisi:</span>
                      <span className="font-bold text-destructive">-₺{selectedItem.komisyon_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="bg-primary p-5 rounded-3xl flex justify-between items-center shadow-lg shadow-primary/20">
                    <div>
                      <span className="text-[10px] font-black text-white/70 uppercase block mb-0.5 tracking-widest leading-none">Bu Taksit Neti</span>
                      <span className="text-[9px] font-bold text-white/50">{selectedItem.taksit_no}. Taksit Ödemesi</span>
                    </div>
                    <span className="text-2xl font-black text-white">₺{selectedItem.net_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedItem(null)}
                  className="w-full bg-foreground text-background py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 mt-4 shadow-xl"
                >
                  Pencereyi Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarClock className="text-primary w-6 h-6" />
              Banka Ödemeleri ve Finans Yönetimi
            </h1>
            <p className="text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wider">
              Komisyonlar, blokeler ve ödeme takvimi yönetimi
            </p>
          </div>

          <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
            {activeTab === 'schedule' && (
              <button
                onClick={handleSyncRecords}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-orange-500 hover:bg-orange-500/10 transition-all mr-2"
                title="Geçmiş POS kayıtlarını tara ve ödeme planlarını oluştur"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Geçmişi Planla
              </button>
            )}
            {[
              { id: 'schedule', label: 'Ödeme Takvimi', icon: TableIcon },
              { id: 'analysis', label: 'Finansal Analiz', icon: BarChart3 },
              { id: 'banks', label: 'Banka Ayarları', icon: Building2 },
              { id: 'holidays', label: 'Tatil Günleri', icon: Calendar },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'banks' | 'holidays' | 'schedule' | 'analysis')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[60vh]"
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            </div>
          ) : activeTab === 'schedule' ? (
            <div className="space-y-6">
               {/* Stats Cards Row */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Bugün (Net Bekleyen)', value: stats.today.net, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: 'Toplam Tahsil Edilen', value: stats.received.net, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Bekleyen Ödemeler', value: stats.pending.net, icon: AlertCircle, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Filtreli Net Toplam', value: stats.filteredTotal.net, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  ].map((card, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-card p-5 rounded-3xl border border-border shadow-sm flex items-center gap-4"
                    >
                      <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                        <card.icon size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{card.label}</p>
                        <p className="text-lg font-black text-foreground mt-1">₺{card.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </motion.div>
                  ))}
               </div>

               {/* Filter Bar */}
               <div className="bg-card p-4 rounded-3xl border border-border shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-grow w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Müşteri adı ile ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-2xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                      <select 
                        value={bankFilter}
                        onChange={(e) => setBankFilter(e.target.value)}
                        className="bg-muted/50 border border-border rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold w-full md:min-w-[140px]"
                      >
                        <option value="all">Tüm Bankalar</option>
                        {Array.from(new Set(schedule.map(i => i.kayitlar?.banka))).filter(Boolean).map(bank => (
                          <option key={bank} value={bank}>{bank}</option>
                        ))}
                      </select>
                      <select 
                        value={subeFilter}
                        onChange={(e) => setSubeFilter(e.target.value)}
                        className="bg-muted/50 border border-border rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold w-full md:min-w-[140px]"
                      >
                        <option value="all">Tüm Şubeler</option>
                        {Array.from(new Set(schedule.map(i => i.kayitlar?.sube_adi))).filter(Boolean).map(sube => (
                          <option key={sube} value={sube}>{sube}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Date Range Filter */}
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-center pt-4 border-t border-border/50">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-2">Vade Aralığı:</span>
                      <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                         <input 
                           type="date" 
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
                         />
                         <span className="text-muted-foreground">→</span>
                         <input 
                           type="date" 
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
                         />
                         {(startDate || endDate) && (
                           <button 
                             onClick={() => { setStartDate(''); setEndDate(''); }}
                             className="text-[10px] font-bold text-destructive hover:underline ml-1 whitespace-nowrap"
                           >
                             Sıfırla
                           </button>
                         )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:flex gap-2 lg:ml-auto w-full lg:w-auto">
                       <button 
                         onClick={() => setShowExportModal(true)}
                         className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                       >
                         <Download size={14} /> <span className="hidden sm:inline">Excel</span> İndir
                       </button>
                      <button 
                        onClick={() => setShowDailySummary(!showDailySummary)}
                        className={`text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all border flex items-center justify-center ${showDailySummary ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
                      >
                        {showDailySummary ? 'Liste Görünümü' : 'Günlük Analiz'}
                      </button>
                    </div>
                  </div>
               </div>

               {showExportModal && (
                 <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-card max-w-sm w-full p-8 rounded-3xl border border-border shadow-2xl space-y-6"
                    >
                       <div className="text-center">
                          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                             <Download size={32} />
                          </div>
                          <h3 className="text-lg font-black text-foreground">Excel Dışa Aktar</h3>
                          <p className="text-xs text-muted-foreground mt-2">Hangi verileri indirmek istersiniz?</p>
                       </div>
                       <div className="space-y-3">
                          <button 
                            onClick={() => handleExportExcel('filtered')}
                            className="w-full py-4 px-6 bg-muted hover:bg-primary/10 hover:text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-left flex justify-between items-center group"
                          >
                             Ekranda Filtrelenen Veriler
                             <div className="p-1 px-2 bg-muted-foreground/10 rounded text-[9px] group-hover:bg-primary/20">{filteredSchedule.length} Satır</div>
                          </button>
                          <button 
                             onClick={() => handleExportExcel('all')}
                             className="w-full py-4 px-6 bg-muted hover:bg-primary/10 hover:text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-left flex justify-between items-center group"
                          >
                             Tüm Yılın Plan dökümü
                             <div className="p-1 px-2 bg-muted-foreground/10 rounded text-[9px] group-hover:bg-primary/20">{schedule.length} Satır</div>
                          </button>
                       </div>
                       <button 
                         onClick={() => setShowExportModal(false)}
                         className="w-full py-3 text-[10px] font-black uppercase text-muted-foreground hover:text-foreground"
                       >
                          İptal Et
                       </button>
                    </motion.div>
                 </div>
               )}

               {showDailySummary ? (
                 <div className="space-y-3">
                   {dailySummaries.length === 0 ? (
                     <div className="bg-card p-12 text-center rounded-3xl border border-dashed border-border text-muted-foreground font-bold">
                       Seçili kriterlerde veri bulunamadı.
                     </div>
                   ) : (
                     dailySummaries.map((day) => (
                        <div key={day.date} className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden transition-all hover:shadow-md">
                          <details className="group">
                             <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                                <div className="flex items-center gap-4">
                                   <div className="bg-primary/10 text-primary w-12 h-12 rounded-2xl flex flex-col items-center justify-center">
                                      <span className="text-lg font-black leading-none">{format(parseISO(day.date), 'dd')}</span>
                                      <span className="text-[8px] font-black uppercase opacity-60">{format(parseISO(day.date), 'MMM', { locale: tr })}</span>
                                   </div>
                                   <div>
                                      <h3 className="font-black text-foreground capitalize">{format(parseISO(day.date), 'EEEE', { locale: tr })}</h3>
                                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{format(parseISO(day.date), 'dd MMMM yyyy', { locale: tr })}</p>
                                   </div>
                                </div>
                                <div className="text-right flex items-center gap-6">
                                   <div className="hidden sm:block text-right">
                                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none mb-1">Günlük Net</p>
                                      <div className="flex items-center gap-2 justify-end">
                                         <p className="text-xl font-black text-primary">₺{day.net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                                         <div className={`p-1 rounded-full ${day.net > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                                            <CheckCircle2 size={12} />
                                         </div>
                                      </div>
                                   </div>
                                   <div className="p-2 rounded-lg bg-muted group-open:rotate-180 transition-transform">
                                      <ArrowDown size={16} className="text-muted-foreground" />
                                   </div>
                                </div>
                             </summary>
                             <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                   {Object.entries(day.banks).map(([bank, amount]) => (
                                      <div key={bank} className="bg-card p-4 rounded-2xl border border-border flex justify-between items-center shadow-sm">
                                         <div>
                                            <p className="text-[9px] text-muted-foreground font-black uppercase">{bank}</p>
                                            <p className="text-xs font-black text-foreground mt-0.5">₺{amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                                         </div>
                                         <div className="w-8 h-8 rounded-full bg-emerald-500/5 flex items-center justify-center">
                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                         </div>
                                      </div>
                                   ))}
                                </div>
                                <div className="mt-4 flex justify-end gap-8 px-2 text-[11px] font-bold">
                                   <div className="flex gap-2">
                                      <span className="text-muted-foreground uppercase">Taksit Brüt:</span>
                                      <span className="text-foreground">₺{day.gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                   </div>
                                   <div className="flex gap-2">
                                      <span className="text-muted-foreground uppercase">Toplam Kesinti:</span>
                                      <span className="text-destructive">₺{day.comm.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                   </div>
                                </div>
                             </div>
                          </details>
                        </div>
                     ))
                   )}
                 </div>
               ) : (
                <div className="bg-card rounded-3xl border border-border shadow-xl overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-muted text-[11px] uppercase font-black text-foreground tracking-widest border-b border-border">
                        <th 
                          className="px-8 py-5 cursor-pointer hover:bg-muted-foreground/5 transition-colors"
                          onClick={() => requestSort('planlanan_tarih')}
                        >
                          <div className="flex items-center gap-2">
                            Planlanan Tarih 
                            {sortConfig.key === 'planlanan_tarih' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-30"/>}
                          </div>
                        </th>
                        <th 
                          className="px-8 py-5 cursor-pointer hover:bg-muted-foreground/5 transition-colors"
                          onClick={() => requestSort('sube')}
                        >
                          <div className="flex items-center gap-2">
                            Şube / Müşteri
                            {sortConfig.key === 'sube' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-30"/>}
                          </div>
                        </th>
                        <th 
                          className="px-8 py-5 cursor-pointer hover:bg-muted-foreground/5 transition-colors"
                          onClick={() => requestSort('banka')}
                        >
                          <div className="flex items-center gap-2">
                            Banka / Taksit
                            {sortConfig.key === 'banka' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-30"/>}
                          </div>
                        </th>
                        <th className="px-8 py-5 text-right">Brüt Tutar</th>
                        <th className="px-8 py-5 text-right">Komisyon</th>
                        <th 
                          className="px-8 py-5 text-right text-primary cursor-pointer hover:bg-muted-foreground/5 transition-colors"
                          onClick={() => requestSort('net_tutar')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Net Tutar
                            {sortConfig.key === 'net_tutar' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>) : <ArrowUpDown size={12} className="opacity-30"/>}
                          </div>
                        </th>
                        <th className="px-8 py-5 text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSchedule.map((item) => (
                        <tr 
                          key={item.id} 
                          className="hover:bg-muted/50 transition-colors group"
                        >
                          <td className="px-8 py-6 cursor-pointer" onClick={() => setSelectedItem(item)}>
                            <div className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                              {format(parseISO(item.planlanan_tarih), 'dd MMMM yyyy', { locale: tr })}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                              {format(parseISO(item.planlanan_tarih), 'EEEE', { locale: tr })}
                            </div>
                          </td>
                          <td className="px-8 py-6 cursor-pointer" onClick={() => setSelectedItem(item)}>
                            <div className="font-extrabold text-sm text-foreground">{item.kayitlar?.sube_adi}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">{item.kayitlar?.musteri_adi}</div>
                          </td>
                          <td className="px-8 py-6 cursor-pointer" onClick={() => setSelectedItem(item)}>
                            <div className="text-xs font-black text-foreground uppercase tracking-tighter">{item.kayitlar?.banka}</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase">{item.taksit_no}. Taksit / {item.kayitlar?.taksit}</div>
                          </td>
                          <td className="px-8 py-6 text-right font-bold text-sm text-foreground">
                            ₺{item.ana_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-8 py-6 text-right font-bold text-sm text-destructive">
                            -₺{item.komisyon_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-8 py-6 text-right font-black text-base text-primary">
                            ₺{item.net_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-8 py-6 text-center">
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id!, item.durum); }}
                               disabled={statusLoading === item.id}
                               className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 mx-auto ${item.durum === 'YATTI' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20'}`}
                             >
                                {statusLoading === item.id ? <Loader2 size={12} className="animate-spin" /> : (item.durum === 'YATTI' ? <CheckCircle size={12} /> : <Clock size={12} />)}
                                {item.durum === 'YATTI' ? 'YATTI' : 'BEKLEMEDE'}
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50">
                       <tr className="border-t-2 border-border">
                          <td colSpan={3} className="px-8 py-5 text-xs font-black uppercase text-muted-foreground tracking-widest text-right">
                             Filtrelenmiş Toplam ({stats.filteredTotal.count} İşlem):
                          </td>
                          <td className="px-8 py-5 text-right font-black text-sm text-foreground">
                             ₺{stats.filteredTotal.gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-sm text-destructive">
                             -₺{stats.filteredTotal.comm.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-lg text-primary">
                             ₺{stats.filteredTotal.net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                       </tr>
                    </tfoot>
                  </table>
                </div>
               )}
            </div>
          ) : activeTab === 'analysis' ? (
            <div className="space-y-8 pb-12">
               {/* Line Chart Section */}
               <div className="bg-card p-8 rounded-[40px] border border-border shadow-xl">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h3 className="text-xl font-black text-foreground">Aylık Nakit Akış Öngörüsü</h3>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Önümüzdeki 12 ay için beklenen tahsilat grafiği</p>
                     </div>
                     <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-primary" /> Net Giriş
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-muted-foreground opacity-30" /> Brüt İşlem
                        </div>
                     </div>
                  </div>
                  <div className="h-[350px] w-full min-h-[350px]">
                     <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                         <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--foreground), 0.05)" />
                            <XAxis 
                               dataKey="month" 
                               axisLine={false}
                               tickLine={false}
                               tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.5 }}
                               dy={15}
                            />
                            <YAxis 
                               axisLine={false}
                               tickLine={false}
                               tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.5 }}
                               tickFormatter={(value) => `₺${((value || 0) / 1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                               contentStyle={{ 
                                  backgroundColor: 'var(--card)', 
                                  borderRadius: '24px', 
                                  border: '1px solid var(--border)',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                  fontSize: '11px',
                                  fontWeight: 900
                               }}
                               formatter={(value: string | number | readonly (string | number)[] | undefined) => value !== undefined ? [`₺${Number(value || 0).toLocaleString('tr-TR')}`, ''] : ['', '']}
                            />
                            <Line 
                               type="monotone" 
                               dataKey="net" 
                               stroke="var(--primary)" 
                               strokeWidth={4} 
                               dot={{ r: 6, fill: 'var(--primary)', strokeWidth: 3, stroke: 'var(--card)' }}
                               activeDot={{ r: 8, strokeWidth: 0 }}
                               animationDuration={1500}
                            />
                            <Line 
                               type="monotone" 
                               dataKey="gross" 
                               stroke="currentColor" 
                               strokeWidth={2} 
                               strokeDasharray="5 5" 
                               opacity={0.15}
                               dot={false}
                            />
                         </LineChart>
                      </ResponsiveContainer>
                  </div>
               </div>

               {/* Bank Efficiency Section */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-card p-8 rounded-[40px] border border-border shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                           <PieChart size={20} />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-foreground">Banka Verimlilik Skoru</h3>
                           <p className="text-xs text-muted-foreground font-medium">Banka bazlı gerçek maliyet ve hacim analizi</p>
                        </div>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/50">
                                 <th className="pb-4 pl-2">Banka</th>
                                 <th className="pb-4 text-right">İşlem Hacmi</th>
                                 <th className="pb-4 text-right">Ödenen Komisyon</th>
                                 <th className="pb-4 text-center">Efektif Oran</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border/30">
                              {bankEfficiency.map((bank) => {
                                 const effectiveRate = (bank.totalComm / bank.totalGross) * 100;
                                 return (
                                    <tr key={bank.name} className="group hover:bg-muted/30 transition-colors">
                                       <td className="py-4 pl-2">
                                          <div className="font-black text-sm text-foreground">{bank.name}</div>
                                          <div className="text-[10px] text-muted-foreground font-bold">{bank.count} Başarılı İşlem</div>
                                       </td>
                                       <td className="py-4 text-right font-black text-sm">
                                          ₺{bank.totalGross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                       </td>
                                       <td className="py-4 text-right font-bold text-sm text-destructive">
                                          -₺{bank.totalComm.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                       </td>
                                       <td className="py-4 text-center">
                                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${effectiveRate > 2 ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                             %{isNaN(effectiveRate) ? '0.00' : effectiveRate.toFixed(2)}
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 flex flex-col justify-between h-full min-h-[300px]">
                        <div>
                           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                              <TrendingUp size={24} />
                           </div>
                           <h4 className="text-xl font-extrabold leading-tight">Toplam Finansal Sağlık</h4>
                           <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-2">Tüm Şubeler Dahil</p>
                        </div>
                        <div className="mt-8 space-y-4">
                           <div className="flex justify-between items-end">
                              <span className="text-xs font-bold text-white/70 uppercase">Genel Brüt:</span>
                              <span className="text-xl font-black">₺{schedule.reduce((acc, curr) => acc + curr.ana_tutar, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between items-end border-t border-white/10 pt-4">
                              <span className="text-xs font-bold text-white/70 uppercase">Toplam Kesinti:</span>
                              <span className="text-xl font-black text-white/60">₺{schedule.reduce((acc, curr) => acc + curr.komisyon_tutar, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between items-end border-t border-white/20 pt-4">
                              <span className="text-xs font-black uppercase text-white/80">Net Projeksiyon:</span>
                              <span className="text-3xl font-black">₺{schedule.reduce((acc, curr) => acc + curr.net_tutar, 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          ) : activeTab === 'banks' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-foreground uppercase tracking-tighter flex items-center gap-2">
                   <Building2 className="text-primary" /> Banka ve Komisyon Yönetimi
                </h2>
                <button 
                  onClick={handleAddNewBank}
                  className="px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2"
                >
                   <Plus size={14} /> Yeni Banka Tanımla
                </button>
              </div>
              <div className="space-y-2">
              {Object.entries(
                banks.reduce((acc, bank) => {
                  if (!acc[bank.banka_adi]) acc[bank.banka_adi] = [];
                  acc[bank.banka_adi].push(bank);
                  return acc;
                }, {} as Record<string, BankSettings[]>)
              ).map(([bankName, history]) => {
                const sortedHistory = [...history].sort((a, b) => a.baslangic_tarihi.localeCompare(b.baslangic_tarihi));
                const now = new Date().toISOString().split('T')[0];
                const activeAgreement = sortedHistory.find(h =>
                    h.baslangic_tarihi <= now && (!h.bitis_tarihi || h.bitis_tarihi >= now)
                ) || sortedHistory[sortedHistory.length - 1];
                const isOpen = expandedBank === bankName;

                return (
                  <div key={bankName} className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
                    {/* Accordion Header */}
                    <div
                      className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/30 transition-all"
                      onClick={() => setExpandedBank(isOpen ? null : bankName)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <h3 className="font-black text-base text-foreground">{bankName}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {history.length} anlaşma · Aktif oran (1T): %{activeAgreement?.komisyon_oranlari?.['1'] ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 mr-4">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               const agreement = activeAgreement!;
                               handleUpdateBank({...agreement, is_active: !agreement.is_active});
                             }}
                             className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all ${activeAgreement?.is_active !== false ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}
                           >
                             {activeAgreement?.is_active !== false ? 'AKTİF' : 'PASİF'}
                           </button>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               const agreement = activeAgreement!;
                               handleUpdateBank({...agreement, holiday_calculation_active: !agreement.holiday_calculation_active});
                             }}
                             title="Tatil Günü Kaydırma"
                             className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all flex items-center gap-1 ${activeAgreement?.holiday_calculation_active !== false ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}
                           >
                             <Calendar size={10} />
                             {activeAgreement?.holiday_calculation_active !== false ? 'KAYDIRMA AÇIK' : 'KAYDIRMA KAPALI'}
                           </button>
                        </div>
                        {activeAgreement && (
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase">
                            {activeAgreement.baslangic_tarihi} →
                            {activeAgreement.bitis_tarihi ? ` ${activeAgreement.bitis_tarihi}` : ' Devam'}
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Accordion Body */}
                    {isOpen && (
                      <div className="px-6 pb-6 space-y-4 border-t border-border/50">
                        {/* Action bar */}
                        <div className="flex items-center justify-between pt-4">
                          <span className="text-[11px] uppercase font-black text-primary tracking-widest">Anlaşma Geçmişi</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const startDate = window.prompt(`${bankName} için yeni anlaşma başlangıç tarihini girin (YYYY-MM-DD):`, new Date().toISOString().split('T')[0]);
                                if (startDate) {
                                  const newAgreement: BankSettings = {
                                    banka_adi: bankName,
                                    baslangic_tarihi: startDate,
                                    bitis_tarihi: null,
                                    vade_gun: activeAgreement.vade_gun,
                                    komisyon_oranlari: { ...activeAgreement.komisyon_oranlari }
                                  };
                                  handleCreateNewAgreement(newAgreement);
                                }
                              }}
                              className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                            >
                              + Yeni Anlaşma
                            </button>
                            <button
                              onClick={() => handleDeleteBank(bankName)}
                              className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Bankayı Sil
                            </button>
                          </div>
                        </div>

                        {/* Agreement Timeline */}
                        <div className="space-y-3">
                          {sortedHistory.map((agreement) => {
                            const isActive = agreement.id === activeAgreement?.id;
                            return (
                              <div
                                key={agreement.id}
                                className={`p-4 rounded-2xl border transition-all ${
                                  isActive ? 'bg-primary/5 border-primary' : 'bg-muted/20 border-border/50'
                                }`}
                              >
                                {/* Date + vade + actions row */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                                  {isActive && <span className="px-2 py-0.5 bg-primary text-white rounded-full text-[9px] font-black uppercase">Aktif</span>}

                                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase">Başlangıç</span>
                                      <input
                                        type="date"
                                        value={agreement.baslangic_tarihi}
                                        onChange={(e) => setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, baslangic_tarihi: e.target.value} : b))}
                                        className="bg-muted/40 border border-border/50 rounded-lg px-2 py-1 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary/50 outline-none"
                                      />
                                    </div>
                                    <span className="text-muted-foreground font-bold">→</span>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase">Bitiş</span>
                                      <input
                                        type="date"
                                        value={agreement.bitis_tarihi ?? ''}
                                        placeholder="Süresiz"
                                        onChange={(e) => setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, bitis_tarihi: e.target.value || null} : b))}
                                        className="bg-muted/40 border border-border/50 rounded-lg px-2 py-1 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary/50 outline-none"
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase">Vade (Gün)</span>
                                      <input
                                        type="number"
                                        value={agreement.vade_gun}
                                        onChange={(e) => setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, vade_gun: parseInt(e.target.value)} : b))}
                                        className="bg-muted/40 border border-border/50 rounded-lg px-2 py-1 text-xs font-bold text-foreground w-20 focus:ring-1 focus:ring-primary/50 outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 ml-auto">
                                    <button
                                      onClick={() => {
                                        // Overlap check
                                        const others = sortedHistory.filter(h => h.id !== agreement.id);
                                        const hasOverlap = others.some(h => {
                                          const aStart = agreement.baslangic_tarihi;
                                          const aEnd = agreement.bitis_tarihi;
                                          const hStart = h.baslangic_tarihi;
                                          const hEnd = h.bitis_tarihi;
                                          const aEndEff = aEnd ?? '9999-12-31';
                                          const hEndEff = hEnd ?? '9999-12-31';
                                          return aStart <= hEndEff && aEndEff >= hStart;
                                        });
                                        if (hasOverlap) {
                                          alert('Hata: Bu anlaşmanın tarihleri başka bir anlaşmayla çakışıyor. Lütfen başa baş (bitiş+1=başlangıç) tarihler kullanın.');
                                          return;
                                        }
                                        handleUpdateBank(agreement);
                                      }}
                                      disabled={saving === agreement.id}
                                      className="p-2 bg-card hover:bg-muted border border-border rounded-lg text-primary transition-all"
                                      title="Kaydet"
                                    >
                                      {saving === agreement.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAgreement(agreement.id!)}
                                      className="p-2 bg-destructive/10 hover:bg-destructive hover:text-white border border-destructive/20 rounded-lg text-destructive transition-all"
                                      title="Sil"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                </div>

                                {/* Commission rates grid */}
                                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                   {Array.from(new Set(['1','2','3','4','5','6','7','8','9','10','11','12',...Object.keys(agreement.komisyon_oranlari)]))
                                     .sort((a,b) => parseInt(a)-parseInt(b))
                                     .filter(count => agreement.komisyon_oranlari[count] !== undefined || ['1','2','3','4','5','6'].includes(count))
                                     .map(count => (
                                       <div key={count} className="bg-background/60 p-3 rounded-2xl border border-border/40 relative group/inst">
                                         <button 
                                           onClick={() => {
                                             if (window.confirm(`${count} taksitli çekim ayarını silmek istediğinize emin misiniz?`)) {
                                               const newRates = {...agreement.komisyon_oranlari};
                                               delete newRates[count];
                                               const newBlokaj = {...(agreement.blokaj_gunleri || {})};
                                               delete newBlokaj[count];
                                               setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, komisyon_oranlari: newRates, blokaj_gunleri: newBlokaj} : b));
                                             }
                                           }}
                                           className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover/inst:opacity-100 transition-opacity z-10"
                                         >
                                           <X size={10} />
                                         </button>
                                         <div className="flex flex-col gap-2">
                                           <div className="flex justify-between items-center">
                                              <span className="text-[10px] font-black text-muted-foreground uppercase">{count} TAKSİT</span>
                                           </div>
                                           <div className="space-y-2">
                                              <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5 rounded-lg">
                                                <span className="text-[9px] font-bold text-primary">%</span>
                                                <input
                                                  type="number" step="0.01"
                                                  value={agreement.komisyon_oranlari[count] ?? 0}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const newRates = {...agreement.komisyon_oranlari, [count]: isNaN(val) ? 0 : val};
                                                    setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, komisyon_oranlari: newRates} : b));
                                                  }}
                                                  className="bg-transparent border-none p-0 text-xs font-black text-foreground w-full focus:ring-0 outline-none"
                                                />
                                              </div>
                                              <div className="flex items-center gap-1 bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/10">
                                                <Clock size={10} className="text-primary" />
                                                <input
                                                  type="number"
                                                  placeholder="Gün"
                                                  value={agreement.blokaj_gunleri?.[count] ?? (count === '1' ? agreement.vade_gun : 30)}
                                                  onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const newBlokaj = {...(agreement.blokaj_gunleri || {}), [count]: isNaN(val) ? 0 : val};
                                                    setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, blokaj_gunleri: newBlokaj} : b));
                                                  }}
                                                  className="bg-transparent border-none p-0 text-[10px] font-bold text-primary w-full focus:ring-0 outline-none"
                                                />
                                                <span className="text-[8px] font-black text-primary/50">GÜN</span>
                                              </div>
                                           </div>
                                         </div>
                                       </div>
                                     ))}
                                   <button
                                     onClick={() => {
                                       const count = window.prompt('Eklemek istediğiniz taksit sayısı:');
                                       if (count && !isNaN(parseInt(count))) {
                                         const newRates = {...agreement.komisyon_oranlari, [count]: 0};
                                         setBanks(prev => prev.map(b => b.id === agreement.id ? {...b, komisyon_oranlari: newRates} : b));
                                       }
                                     }}
                                     className="border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all min-h-[100px] gap-2"
                                   >
                                     <Plus size={20} />
                                     <span className="text-[9px] font-black uppercase">Taksit Ekle</span>
                                   </button>
                                 </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="glassmorphism p-6 rounded-2xl border border-border/50">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Info className="text-primary w-4 h-4" /> 2026 Resmî Tatilleri
                </h3>
                <div className="space-y-2">
                  {holidays.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                      <div className="flex items-center gap-4">
                        <Calendar size={14} className="text-primary" />
                        <div>
                          <p className="text-sm font-bold">{format(parseISO(h.tarih), 'dd MMMM yyyy', { locale: tr })}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{h.aciklama}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}
