import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Sube } from '../types';
import MainLayout from '../components/layout/MainLayout';
import { 
  Target, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Building2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Users,
  History,
  Copy,
  Check,
  RefreshCcw,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Smartphone,
  User,
  Info,
  Search,
  Monitor,
  Tablet,
  Cpu,
  LayoutGrid
} from 'lucide-react';
import { format, getMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { logAction } from '../utils/logger';

const subeler: Sube[] = ['MERKEZ', 'ANKARA', 'BURSA', 'BAYRAMPAŞA', 'MODOKO', 'İZMİR', 'MALZEME'];

// Types
interface SubeCode {
  id: string;
  sube_adi: Sube;
  access_code: string;
  updated_at: string;
}

interface LogEntry {
  id: string;
  created_at: string;
  user_id: string;
  sube_adi: string;
  islem_tipi: string;
  detaylar: any;
  cihaz_bilgisi: string;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'targets'>('users');
  
  // User Management States
  const [codes, setCodes] = useState<SubeCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  // Log Management States
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Target Management States (New)
  const [hedefler, setHedefler] = useState<Record<string, number>>({});
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [successTarget, setSuccessTarget] = useState<string | null>(null);

  const currentMonth = getMonth(new Date()) + 1;
  const currentYear = new Date().getFullYear();

  const role = user?.user_metadata?.role;

  // Data Fetching
  const fetchCodes = async () => {
    setLoadingCodes(true);
    try {
      const { data, error } = await supabase
        .from('sube_codes')
        .select('*')
        .order('sube_adi');
      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error fetching access codes:', error);
    } finally {
      setLoadingCodes(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('islem_loglari')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchHedefler = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const { data, error } = await supabase
        .from('hedefler')
        .select('*')
        .eq('ay', currentMonth)
        .eq('yil', currentYear);

      if (error) throw error;
      
      const targetMap: Record<string, number> = {};
      data?.forEach(h => {
        targetMap[h.sube_adi] = h.hedef_tutar;
      });
      setHedefler(targetMap);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoadingTargets(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (activeTab === 'users') fetchCodes();
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'targets') fetchHedefler();
  }, [activeTab, fetchHedefler]);

  // Shared Helpers
  const handleSaveTarget = async (sube: string) => {
    const tutar = hedefler[sube] || 0;
    setSavingTarget(sube);
    
    try {
      const { error } = await supabase
        .from('hedefler')
        .upsert({
          sube_adi: sube,
          hedef_tutar: tutar,
          ay: currentMonth,
          yil: currentYear
        }, {
          onConflict: 'sube_adi,ay,yil'
        });

      if (error) throw error;

      await logAction({
        userId: user?.id || '',
        subeAdi: 'MERKEZ',
        action: 'KAYIT_DUZENLEME',
        details: { 
          islem: 'HEDEF_GUNCELLEME',
          hedef_sube: sube,
          tutar: tutar,
          ay: currentMonth,
          yil: currentYear
        }
      });
      
      setSuccessTarget(sube);
      setTimeout(() => setSuccessTarget(null), 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Hata: ' + message);
    } finally {
      setSavingTarget(null);
    }
  };

  const handleInputChangeTarget = (sube: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setHedefler(prev => ({
      ...prev,
      [sube]: numValue
    }));
  };
  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobi')) return <Smartphone className="w-4 h-4" />;
    if (ua.includes('tablet')) return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.sube_adi?.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
      log.islem_tipi?.toLowerCase().includes(logSearchTerm.toLowerCase())
    );
  }, [logs, logSearchTerm]);

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Sistem Yönetimi ve Denetim</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-12 uppercase font-black tracking-widest opacity-70">
              {activeTab === 'users' ? 'Kullanıcı Erişim ve Şifre Yönetimi' : 'İşlem Geçmişi ve Güvenlik Logları'}
            </p>
          </div>

          <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
            {[
              { id: 'users', label: 'Erişim Kodları', icon: Users },
              { id: 'logs', label: 'İşlem Logları', icon: History },
              { id: 'targets', label: 'Şube Hedefleri', icon: Target }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'users' | 'logs' | 'targets')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[60vh]">
          <AnimatePresence mode="wait">
            {activeTab === 'users' ? (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                <div className="lg:col-span-8 space-y-4">
                  <div className="glassmorphism rounded-2xl border border-border/50 overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                          <th className="px-6 py-4">Şube Bilgisi</th>
                          <th className="px-6 py-4">Giriş Kodu (Password)</th>
                          <th className="px-6 py-4 text-right">Eylem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {loadingCodes ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td colSpan={3} className="px-6 py-4 h-16 bg-muted/20" />
                            </tr>
                          ))
                        ) : (
                          codes.map((item) => (
                            <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-black text-sm">{item.sube_adi}</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">{item.sube_adi.toLowerCase()}@tahsilat.by</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <code className="bg-black/40 px-3 py-1.5 rounded-lg text-sm font-mono tracking-widest text-primary min-w-[120px] text-center border border-white/5">
                                    {showCodes[item.id] ? item.access_code : '••••••••'}
                                  </code>
                                  <button 
                                    onClick={() => setShowCodes(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                    className="p-1.5 bg-muted/50 rounded-lg hover:text-primary transition-colors"
                                  >
                                    {showCodes[item.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleCopy(item.access_code, item.id)}
                                  className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border border-primary/20"
                                >
                                  {copiedId === item.id ? (
                                    <><Check size={14} /> BAŞARILI</>
                                  ) : (
                                    <><Copy size={14} /> KODU KOPYALA</>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 shadow-inner">
                    <h3 className="text-xs font-black flex items-center gap-2 mb-4 uppercase tracking-widest text-primary">
                      <ShieldCheck className="w-5 h-5" /> Güvenlik Notu
                    </h3>
                    <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                      <p>
                        Şube giriş kodları şifre yerine geçer. <strong className="text-foreground">Lütfen kodları üçüncü şahıslarla paylaşmayın.</strong>
                      </p>
                      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex gap-3">
                        <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        <p className="text-orange-200/80 font-medium">
                          Yalnızca kurumsal ağlar ve güvenli kanallar üzerinden şube şifrelerini iletin.
                        </p>
                      </div>
                    </div>
                    <button 
                       onClick={fetchCodes}
                       className="w-full mt-6 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                      <RefreshCcw className={`w-4 h-4 ${loadingCodes ? 'animate-spin' : ''}`} />
                      Şifre Listesini Yenile
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'logs' ? (
              <motion.div
                key="logs"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex bg-muted/20 p-4 rounded-2xl border border-border/50 items-center justify-between gap-4">
                   <div className="relative flex-grow max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Şube adı veya işlem ara..."
                        value={logSearchTerm}
                        onChange={(e) => setLogSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <button 
                      onClick={fetchLogs}
                      className="p-2.5 bg-card border border-border/50 rounded-xl text-muted-foreground hover:text-primary transition-colors"
                    >
                      <RefreshCcw className={`w-5 h-5 ${loadingLogs ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loadingLogs ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        layout
                        className="glassmorphism rounded-2xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all"
                      >
                        <div 
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                            <div className="w-full md:w-32 flex-shrink-0">
                              <div className="text-[10px] font-black text-muted-foreground uppercase opacity-50">
                                {format(new Date(log.created_at), 'dd MMM yyyy', { locale: tr })}
                              </div>
                              <div className="text-sm font-black text-foreground tracking-tighter">
                                {format(new Date(log.created_at), 'HH:mm:ss')}
                              </div>
                            </div>

                            <div className="w-full md:w-40 flex-shrink-0 flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[11px] font-black uppercase text-primary tracking-tighter leading-none">{log.sube_adi}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[120px] font-medium">{log.user_id}</p>
                              </div>
                            </div>

                            <div className="flex-grow">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                                log.islem_tipi === 'TOPLU_AKTARIM' ? 'bg-purple-500/10 text-purple-500' :
                                log.islem_tipi === 'KAYIT_SILME' ? 'bg-destructive/10 text-destructive' :
                                'bg-blue-500/10 text-blue-500'
                              }`}>
                                <Info className="w-3.5 h-3.5" />
                                {log.islem_tipi.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-muted-foreground bg-muted/40 px-3 py-2 rounded-xl border border-border/50">
                              {getDeviceIcon(log.cihaz_bilgisi)}
                              <span className="text-[10px] font-black hidden lg:inline max-w-[120px] truncate uppercase tracking-tighter">
                                {log.cihaz_bilgisi.split(')')[0].split('(')[1]?.split(';')[0] || 'Web Cihazı'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedLogId === log.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-black/20 border-t border-border/50"
                            >
                              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5" /> Cihaz Kimliği / User Agent
                                  </h4>
                                  <div className="text-[10px] bg-black/40 p-3 rounded-xl border border-white/5 font-mono break-all text-gray-500 leading-relaxed shadow-inner">
                                    {log.cihaz_bilgisi}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                    <LayoutGrid className="w-3.5 h-3.5" /> İşlem Verisi
                                  </h4>
                                  <pre className="text-[10px] bg-black/40 p-4 rounded-xl border border-white/5 font-mono overflow-auto max-h-48 text-primary shadow-inner">
                                    {JSON.stringify(log.detaylar, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
                <motion.div
                key="targets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest uppercase">Şube Hedef Yönetimi</h3>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter opacity-70">Aylık Kota Belirleme</p>
                    </div>
                  </div>
                  
                  <div className="glassmorphism px-4 py-2 rounded-xl border border-border/50 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-80">
                      {format(new Date(), 'MMMM yyyy', { locale: tr })}
                    </span>
                  </div>
                </div>

                {loadingTargets ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subeler.map((sube, index) => (
                      <motion.div
                        key={sube}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glassmorphism p-5 rounded-2xl border border-border/50 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <Building2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="font-black text-sm tracking-tighter uppercase">{sube}</span>
                          </div>
                          {successTarget === sube && (
                            <motion.div 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }} 
                              className="text-emerald-500 flex items-center gap-1 text-[9px] font-black bg-emerald-500/10 px-2 py-0.5 rounded-full"
                            >
                              <CheckCircle2 className="w-3 h-3" /> KAYDEDİLDİ
                            </motion.div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative flex-grow">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-black">₺</div>
                            <input 
                              type="number" 
                              value={hedefler[sube] || ''}
                              onChange={(e) => handleInputChangeTarget(sube, e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-muted/30 border border-border/50 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveTarget(sube)}
                            disabled={savingTarget === sube}
                            className="flex-shrink-0 bg-primary hover:bg-primary/90 text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.95] disabled:opacity-50"
                          >
                            {savingTarget === sube ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          </button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-50">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span>Performans Takibi</span>
                          </div>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="glassmorphism p-6 rounded-3xl border border-primary/20 bg-primary/5 flex items-start gap-4 shadow-inner">
                  <div className="p-3 bg-primary/20 rounded-2xl">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-1">Hedef Yönetim Rehberi</h3>
                    <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tight opacity-70">
                      Belirlediğiniz hedefler anlık olarak ilgili şubenin ana ekranına yansır. 
                      Hedefler her ayın başında o aya özel olarak girilmelidir. 
                      Sistem Audit Log altyapısı ile kimin hangi hedefi ne zaman güncellediğini kayıt altında tutar.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
