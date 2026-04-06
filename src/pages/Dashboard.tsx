import { useEffect, useState, useCallback } from 'react';
import { isToday } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Kayit } from '../types';
import MainLayout from '../components/layout/MainLayout';
import StatsCards from '../components/dashboard/StatsCards';
import RecordForm from '../components/dashboard/RecordForm';
import RecordsTable from '../components/dashboard/RecordsTable';
import { exportToExcel } from '../utils/excelUtils';
import { motion } from 'framer-motion';
import { FileDown, RefreshCcw, PlusCircle, Table as TableIcon } from 'lucide-react';
import EditRecordModal from '../components/dashboard/EditRecordModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Kayit[]>([]);
  const [allMonthRecords, setAllMonthRecords] = useState<Kayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'new'>('records');
  const [editingRecord, setEditingRecord] = useState<Kayit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditRequest, setIsEditRequest] = useState(false);
  const [targetAmount, setTargetAmount] = useState(0);

  const role = (user?.user_metadata?.role as 'admin' | 'branch') || 'branch';
  const sube = (user?.user_metadata?.sube as string) || 'Bilinmiyor';
  const isAdmin = role === 'admin';

  const PAGE_SIZE = 20;

  const fetchTarget = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hedefler')
        .select('hedef_tutar')
        .eq('sube_adi', sube)
        .eq('ay', new Date().getMonth() + 1)
        .eq('yil', new Date().getFullYear())
        .maybeSingle();

      if (error) throw error;
      setTargetAmount(data?.hedef_tutar || 0);
    } catch (error) {
      console.error('Error fetching target:', error);
    }
  }, [sube]);

  // KOTA DOSTU: Sadece istatistikler için gerekli hafif kolonları çek (Aylık)
  const fetchMonthStats = useCallback(async () => {
    try {
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      let query = supabase
        .from('kayitlar')
        .select('tutar, tarih, musteri_adi, sube_adi')
        .gte('tarih', firstDay);

      if (role !== 'admin') {
        query = query.eq('sube_adi', sube);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAllMonthRecords(data as Kayit[] || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [role, sube]);

  // PERFORMANS: Tablo için sadece limitli veri çek
  const fetchRecords = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
      setPage(0);
    }
    
    const currentPage = isRefreshing ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('kayitlar')
        .select('*')
        .order('tarih', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (role !== 'admin') {
        query = query.eq('sube_adi', sube);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (isRefreshing) {
        setRecords(data || []);
      } else {
        setRecords(prev => {
          const newRecords = data || [];
          // Mükerrer kayıtları engelle (De-duplication)
          const existingIds = new Set(prev.map(r => r.id));
          const uniqueNewRecords = newRecords.filter(r => !existingIds.has(r.id));
          return [...prev, ...uniqueNewRecords];
        });
      }
      
      setHasMore(data?.length === PAGE_SIZE);
      if (!isRefreshing) setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, sube, page]);

  useEffect(() => {
    fetchRecords(true);
    fetchMonthStats();
    fetchTarget();
  }, [fetchMonthStats, fetchTarget]); // Removed fetchRecords(true) from here to prevent loops, called initially

  const handleExport = () => {
    exportToExcel(records);
  };

  return (
    <MainLayout>
      <EditRecordModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        record={editingRecord} 
        onSuccess={fetchRecords} 
        isRequest={isEditRequest}
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-0.5">
            {isAdmin ? 'Merkez Yönetim Paneli' : `${sube} Şube Paneli`}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            Günlük tahsilat ve satış verilerini takip edin.
            {refreshing && <RefreshCcw className="w-3 h-3 animate-spin text-primary" />}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRecords(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <FileDown className="w-4 h-4" />
            Excel Export
          </button>
        </div>
      </div>

      <StatsCards records={allMonthRecords} targetAmount={targetAmount} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-6">
          {/* Navigation Tabs (Compact) */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border">
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'records' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tüm Kayıtlar
            </button>
            <button
                onClick={() => setActiveTab('new')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'new' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Yeni Kayıt
              </button>
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'records' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between ml-1">
                  <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <TableIcon className="w-4 h-4" />
                    Son İşlemler
                  </h3>
                </div>
                <RecordsTable 
                  records={records} 
                  loading={loading} 
                  onRefresh={() => fetchRecords(true)}
                  onEdit={(record) => {
                    setEditingRecord(record);
                    setIsEditRequest(role !== 'admin');
                    setIsEditModalOpen(true);
                  }}
                />
                
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => fetchRecords(false)}
                      disabled={loading}
                      className="px-8 py-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 group"
                    >
                      {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />}
                      Daha Fazla Yükle
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'new' && (
              <RecordForm onSuccess={fetchRecords} />
            )}
          </motion.div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeTab !== 'new' && (
            <RecordForm onSuccess={fetchRecords} />
          )}
          
          <div className="glassmorphism p-4 rounded-xl border border-border/50">
            <h3 className="text-sm font-bold mb-3">Hızlı İstatistikler</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-border/50 text-xs">
                <span className="text-muted-foreground">Bugünkü Kayıt:</span>
                <span className="font-bold">{records.filter(r => isToday(new Date(r.tarih))).length}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50 text-xs">
                <span className="text-muted-foreground">En Çok Kullanılan:</span>
                <span className="font-bold text-primary">Nakit</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Sistem:</span>
                <span className="flex items-center gap-1 font-bold text-green-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Aktif
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
