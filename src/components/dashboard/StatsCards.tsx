import type { Kayit } from '../../types';
import { TrendingUp, UserCheck, Receipt, Building, Calendar, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { isToday, isThisMonth } from 'date-fns';

interface StatsCardsProps {
  records: Kayit[];
  targetAmount: number;
}

export default function StatsCards({ records, targetAmount }: StatsCardsProps) {
  // Monthly Calculations
  const monthlyRecords = records.filter(r => isThisMonth(new Date(r.tarih)));
  const monthlyCiro = monthlyRecords.reduce((acc, curr) => acc + Number(curr.tutar), 0);
  
  // Daily
  const dailyRecords = records.filter(r => isToday(new Date(r.tarih)));
  const dailyCiro = dailyRecords.reduce((acc, curr) => acc + Number(curr.tutar), 0);
  
  // Target Logic (Dynamic from prop)
  const monthlyTarget = targetAmount > 0 ? targetAmount : 1000000; // Fallback to 1M if not set
  const targetProgress = Math.min(Math.round((monthlyCiro / monthlyTarget) * 100), 100);

  const stats = [
    {
      title: 'Bu Ayki Ciro',
      value: `${new Intl.NumberFormat('tr-TR').format(monthlyCiro)} TL`,
      icon: TrendingUp,
      color: 'bg-green-500/10 text-green-500',
      description: `Hedef: ${new Intl.NumberFormat('tr-TR').format(monthlyTarget)} TL`
    },
    {
      title: 'Hedef %',
      value: `%${targetProgress}`,
      icon: Target,
      color: 'bg-blue-500/10 text-blue-500',
      progress: targetProgress
    },
    {
      title: 'Bugün',
      value: `${new Intl.NumberFormat('tr-TR').format(dailyCiro)} TL`,
      icon: Calendar,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Müşteri',
      value: new Set(monthlyRecords.map(r => r.musteri_adi)).size.toString(),
      icon: UserCheck,
      color: 'bg-orange-500/10 text-orange-500',
    },
    {
      title: 'İşlem',
      value: monthlyRecords.length.toString(),
      icon: Receipt,
      color: 'bg-purple-500/10 text-purple-500',
    },
    {
      title: 'Şube',
      value: new Set(records.map(r => r.sube_adi)).size.toString(),
      icon: Building,
      color: 'bg-pink-500/10 text-pink-500',
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="glassmorphism p-3 rounded-xl border border-border/40 hover:border-primary/30 shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${stat.color}`}>
              <stat.icon className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-[9px] uppercase font-bold text-muted-foreground truncate tracking-tight">{stat.title}</h4>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-bold truncate leading-tight">{stat.value}</div>
            {stat.description && (
              <div className="text-[10px] text-muted-foreground font-medium truncate">{stat.description}</div>
            )}
            {stat.progress !== undefined && (
              <div className="w-full bg-muted/50 h-1 rounded-full mt-1.5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.progress}%` }}
                  className={`h-full transition-all duration-1000 ${stat.progress > 80 ? 'bg-green-500' : stat.progress > 40 ? 'bg-primary' : 'bg-orange-500'}`}
                />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
