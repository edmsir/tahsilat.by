import type { Kayit } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface TaksitChartProps {
  records: Kayit[];
}

export default function TaksitChart({ records }: TaksitChartProps) {
  // Group by installment tiers
  const dataMap = records.reduce((acc, record) => {
    const taksit = Number(record.taksit);
    let category = '';
    
    if (taksit === 1) category = 'Tek Çekim';
    else if (taksit <= 6) category = '2-6 Taksit';
    else if (taksit <= 12) category = '7-12 Taksit';
    else category = '12+ Taksit';
    
    acc[category] = (acc[category] || 0) + 1;
    acc[`${category}_total`] = (acc[`${category}_total`] || 0) + Number(record.tutar);
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: 'Tek Çekim', value: dataMap['Tek Çekim'] || 0, total: dataMap['Tek Çekim_total'] || 0 },
    { name: '2-6 Taksit', value: dataMap['2-6 Taksit'] || 0, total: dataMap['2-6 Taksit_total'] || 0 },
    { name: '7-12 Taksit', value: dataMap['7-12 Taksit'] || 0, total: dataMap['7-12 Taksit_total'] || 0 },
    { name: '12+ Taksit', value: dataMap['12+ Taksit'] || 0, total: dataMap['12+ Taksit_total'] || 0 },
  ].filter(d => d.value > 0);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="glassmorphism p-6 rounded-2xl shadow-lg border border-border/50 h-[350px] md:h-[450px] flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground">Taksit Analizi</h3>
        <p className="text-xs text-muted-foreground mt-1">İşlem tutarlarının taksit oranlarına göre dağılımı.</p>
      </div>
      
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff'
              }}
              formatter={(value: string | number | readonly (string | number)[] | undefined, name: string | number | boolean | null | undefined, props: { payload?: { total: number } }) => {
                if (value === undefined || value === null) return ['', String(name)];
                return [
                  `${String(value)} İşlem (${new Intl.NumberFormat('tr-TR').format(Number(props.payload?.total || 0))} TL)`,
                  String(name)
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              content={({ payload }) => (
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {payload?.map((entry: { value?: string | number | boolean | null | undefined; color?: string }, index: number) => (
                    <div key={`legend-${index}`} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-muted-foreground">{String(entry.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
