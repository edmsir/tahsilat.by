import type { Kayit } from '../../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  ChevronUp, 
  ChevronDown, 
  ArrowUpDown, 
  Pencil, 
  Trash2, 
  Lock, 
  Clock 
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface RecordsTableProps {
  records: Kayit[];
  loading: boolean;
  onRefresh?: () => void;
  onEdit?: (record: Kayit, isRequest: boolean) => void;
}

type SortKey = keyof Kayit;
type SortOrder = 'asc' | 'desc';

export default function RecordsTable({ records, loading, onRefresh, onEdit }: RecordsTableProps) {
  const { user } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('tarih');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);

  const role = user?.user_metadata?.role as string;
  const sube = user?.user_metadata?.sube as string;

  const fetchPendingRequests = useCallback(async () => {
    if (!records.length) return;
    try {
      const { data, error } = await supabase
        .from('talepler')
        .select('kayit_id')
        .eq('durum', 'BEKLEMEDE');
      
      if (error) throw error;
      setPendingRequests(data?.map(r => r.kayit_id) || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  }, [records]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const canEditDirectly = () => {
    return role === 'admin';
  };

  const handleDelete = async (record: Kayit) => {
    const direct = canEditDirectly();
    
    if (direct) {
      if (!window.confirm(`${record.musteri_adi} isimli kaydı silmek istediğinize emin misiniz?`)) return;
      setDeletingId(record.id);
      try {
        const { error } = await supabase.from('kayitlar').delete().eq('id', record.id);
        if (error) throw error;
        if (onRefresh) onRefresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Silme işlemi başarısız: ' + message);
      } finally {
        setDeletingId(null);
      }
    } else {
      if (!window.confirm(`Bu kayıt 3 günden eski olduğu için silme TALEBİ oluşturulacaktır. Onaylıyor musunuz?`)) return;
      try {
        const { error } = await supabase.from('talepler').insert({
          kayit_id: record.id,
          tip: 'SILME',
          sube_adi: sube,
          talep_eden_id: user?.id,
          durum: 'BEKLEMEDE'
        });
        if (error) throw error;
        alert('Silme talebi başarıyla iletildi. Admin onayından sonra silinecektir.');
        fetchPendingRequests();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        alert('Talep oluşturulamadı: ' + message);
      }
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedRecords = useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      return sortOrder === 'asc' 
        ? aStr.localeCompare(bStr, 'tr') 
        : bStr.localeCompare(aStr, 'tr');
    });
  }, [records, sortKey, sortOrder]);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12 glassmorphism rounded-2xl border border-dashed border-border/50">
        <div className="text-muted-foreground">Henüz kayıt bulunmamaktadır.</div>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-50" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-primary transition-transform" /> : <ChevronDown className="w-3 h-3 text-primary transition-transform" />;
  };

  const Th = ({ column, label, align = 'left' }: { column: SortKey, label: string, align?: 'left' | 'right' | 'center' }) => (
    <th 
      className={`px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${sortKey === column ? 'text-primary' : ''}`}>{label}</span>
        <SortIcon column={column} />
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {sortedRecords.map((record) => {
          const direct = canEditDirectly();
          const isPending = pendingRequests.includes(record.id);
          
          return (
            <div key={record.id} className="glassmorphism p-4 rounded-2xl border border-border/50 bg-card/30 space-y-3 relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    {format(new Date(record.tarih), 'dd MMMM yyyy', { locale: tr })}
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {record.musteri_adi}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-primary">
                    ₺{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(record.tutar)}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">
                    {record.banka} {record.taksit > 1 && `(${record.taksit} Taksit)`}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-border/10">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-md bg-primary/10 text-primary border border-primary/20">
                    {record.sube_adi}
                  </span>
                  {record.cekim_subesi !== record.sube_adi && (
                    <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-md bg-muted text-muted-foreground border border-border">
                      {record.cekim_subesi}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  {isPending ? (
                    <div className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span className="text-[9px] font-bold uppercase">BEKLEMEDE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onEdit && onEdit(record, !direct)}
                        className={`p-2 rounded-xl transition-all ${direct ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'}`}
                      >
                        {direct ? <Pencil className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDelete(record)}
                        disabled={deletingId === record.id}
                        className={`p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all ${deletingId === record.id ? 'animate-pulse' : ''}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glassmorphism rounded-xl overflow-hidden shadow-xl border border-border/50 bg-card/30">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="bg-muted/50 border-b border-border/50">
              <tr>
                <Th column="tarih" label="Tarih" />
                <Th column="sube_adi" label="Şube" />
                <Th column="musteri_adi" label="Müşteri" />
                <Th column="banka" label="Ödeme Türü" />
                <Th column="cekim_subesi" label="Çekim Şubesi" />
                <Th column="taksit" label="Taksit" align="right" />
                <Th column="tutar" label="Tutar (TL)" align="right" />
                <th className="px-6 py-4 text-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sortedRecords.map((record) => {
                const direct = canEditDirectly();
                const isPending = pendingRequests.includes(record.id);
                
                return (
                  <tr 
                    key={record.id} 
                    className={`hover:bg-primary/5 transition-colors group ${!direct ? 'text-foreground/70' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      {format(new Date(record.tarih), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase py-0.5 px-2 rounded-md bg-primary/10 text-primary border border-primary/20">
                        {record.sube_adi}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80 truncate max-w-[200px]">
                      {record.musteri_adi}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.banka}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.cekim_subesi}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-bold">
                      {record.taksit}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(record.tutar).replace('₺', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {isPending ? (
                          <div 
                            className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20 cursor-help"
                            title="Bu kayıt için bekleyen bir onay talebi bulunmaktadır."
                          >
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span className="text-[10px] font-bold tracking-tight">BEKLEMEDE</span>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => onEdit && onEdit(record, !direct)}
                              className={`p-1.5 rounded-lg transition-colors ${direct ? 'text-blue-500 hover:bg-blue-500/10' : 'text-orange-500 hover:bg-orange-500/10'}`}
                              title={direct ? 'Düzenle' : 'Düzenleme Talebi Gönder'}
                            >
                              {direct ? <Pencil className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDelete(record)}
                              disabled={deletingId === record.id}
                              className={`p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors ${deletingId === record.id ? 'animate-pulse' : ''}`}
                              title={direct ? 'Sil' : 'Silme Talebi Gönder'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
