import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Kayit, Sube, OdemeTuru } from '../types';
import MainLayout from '../components/layout/MainLayout';
import {
  Building2,
  CreditCard,
  Search,
  Table as TableIcon,
  RefreshCcw,
  Download,
  XCircle,
  Calendar,
  PieChart as ChartIcon,
  Sigma,
  TrendingUp,
  Hash,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import EditRecordModal from '../components/dashboard/EditRecordModal';
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import CiroChart from '../components/dashboard/CiroChart';
import TaksitChart from '../components/dashboard/TaksitChart';
import RecordsTable from '../components/dashboard/RecordsTable';
import { exportToExcel } from '../utils/excelUtils';

const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];
const odemeTurleri: OdemeTuru[] = [
  'NAKİT', 'HAVALE / EFT', 'ÇEK', 'SENET', 'AKBANK POS', 'GARANTİ POS',
  'İŞ BANKASI POS', 'ZİRAAT BANKASI POS', 'YAPI KREDİ POS', 'HALKBANK POS',
  'QNB FİNANSBANK POS', 'DENİZBANK POS'
];

export default function Reports() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Kayit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedSube, setSelectedSube] = useState<string>('all');
  const [selectedBanka, setSelectedBanka] = useState<string>('all');
  const [selectedCekim, setSelectedCekim] = useState<string>('all');
  const [selectedTaksit, setSelectedTaksit] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecord, setEditingRecord] = useState<Kayit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditRequest, setIsEditRequest] = useState(false);

  const role = user?.user_metadata?.role;

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kayitlar')
        .select('*')
        .order('tarih', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = parseISO(record.tarih);
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      const dateMatch = isWithinInterval(recordDate, { start, end });
      const subeMatch = selectedSube === 'all' || record.sube_adi === selectedSube;
      const bankaMatch = selectedBanka === 'all' || record.banka === selectedBanka;
      const cekimMatch = selectedCekim === 'all' || record.cekim_subesi === selectedCekim;
      const taksitMatch = selectedTaksit === 'all' || String(record.taksit) === selectedTaksit;
      const searchMatch = !searchTerm ||
        record.musteri_adi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.notlar?.toLowerCase().includes(searchTerm.toLowerCase());

      return dateMatch && subeMatch && bankaMatch && cekimMatch && taksitMatch && searchMatch;
    });
  }, [records, startDate, endDate, selectedSube, selectedBanka, selectedCekim, selectedTaksit, searchTerm]);

  // Dynamic Subtotals (Alt Toplamlar)
  const totals = useMemo(() => {
    const total = filteredRecords.reduce((sum, r) => sum + Number(r.tutar), 0);
    const count = filteredRecords.length;
    const avg = count > 0 ? total / count : 0;
    const max = count > 0 ? Math.max(...filteredRecords.map(r => Number(r.tutar))) : 0;

    return {
      total,
      count,
      avg,
      max
    };
  }, [filteredRecords]);

  const resetFilters = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setSelectedSube('all');
    setSelectedBanka('all');
    setSelectedCekim('all');
    setSelectedTaksit('all');
    setSearchTerm('');
  };

  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-4xl">🚫</div>
            <h2 className="text-2xl font-bold">Yetkisiz Erişim</h2>
            <p className="text-muted-foreground">Bu sayfayı sadece Merkez yöneticileri görüntüleyebilir.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <EditRecordModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        record={editingRecord}
        onSuccess={fetchRecords}
        isRequest={isEditRequest}
      />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <ChartIcon className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Gelişmiş Raporlama</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-12">Filtreleri kullanarak verileri detaylı analiz edin.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchRecords}
              className="p-2 bg-muted/50 rounded-lg text-muted-foreground hover:text-primary transition-colors"
              title="Yenile"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => exportToExcel(filteredRecords, `Raporlar_${startDate}_${endDate}`)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Download className="w-4 h-4" />
              Excel Al ({filteredRecords.length})
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="glassmorphism p-4 rounded-xl border border-border/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <Calendar className="w-3 h-3" /> Başlangıç
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <Calendar className="w-3 h-3" /> Bitiş
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <Building2 className="w-3 h-3" /> Şube Seçimi
            </label>
            <select
              value={selectedSube}
              onChange={(e) => setSelectedSube(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none appearance-none"
            >
              <option value="all">Tüm Şubeler</option>
              {subeler.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <CreditCard className="w-3 h-3" /> Banka / POS
            </label>
            <select
              value={selectedBanka}
              onChange={(e) => setSelectedBanka(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none appearance-none"
            >
              <option value="all">Tüm Ödemeler</option>
              {odemeTurleri.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <CreditCard className="w-3 h-3" /> Taksit Sayısı
            </label>
            <select
              value={selectedTaksit}
              onChange={(e) => setSelectedTaksit(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none appearance-none"
            >
              <option value="all">Tüm Taksitler</option>
              <option value="1">Tek Çekim</option>
              {[2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => <option key={n} value={n}>{n} Taksit</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
              <Search className="w-3 h-3" /> Hızlı Arama
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Müşteri, not..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
              />
              <button
                onClick={resetFilters}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Filtreleri Temizle"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Summary Cards (Alt Toplamlar) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism p-5 rounded-2xl border border-border/50 bg-primary/5 shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sigma className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Filtrelenmiş Toplam</p>
              <h3 className="text-2xl font-black text-primary tracking-tighter italic italic-none">
                ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(totals.total)}
              </h3>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism p-5 rounded-2xl border border-border/50 bg-card/40 shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Hash className="w-12 h-12 text-foreground" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">İşlem Sayısı</p>
              <h3 className="text-2xl font-black text-foreground tracking-tighter italic italic-none">
                {totals.count} Adet
              </h3>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism p-5 rounded-2xl border border-border/50 bg-card/40 shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-12 h-12 text-emerald-500" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ortalama Tahsilat</p>
              <h3 className="text-2xl font-black text-emerald-500 tracking-tighter italic italic-none">
                ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(totals.avg)}
              </h3>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glassmorphism p-5 rounded-2xl border border-border/50 bg-card/40 shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-12 h-12 text-orange-500" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">En Yüksek İşlem</p>
              <h3 className="text-2xl font-black text-orange-500 tracking-tighter italic italic-none">
                ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(totals.max)}
              </h3>
            </div>
          </motion.div>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CiroChart records={filteredRecords} />
          <TaksitChart records={filteredRecords} />
        </div>

        {/* Data List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 ml-1 text-sm font-bold text-muted-foreground">
            <TableIcon className="w-4 h-4" />
            Filtrelenmiş Veri Listesi
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">{filteredRecords.length} Kayıt</span>
          </div>
          <RecordsTable
            records={filteredRecords}
            loading={loading}
            onRefresh={fetchRecords}
            onEdit={(record) => {
              setEditingRecord(record);
              setIsEditRequest(role !== 'admin');
              setIsEditModalOpen(true);
            }}
          />
        </div>
      </div>
    </MainLayout>
  );
}
