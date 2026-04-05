import type { Kayit } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CiroChartProps {
  records: Kayit[];
}

export default function CiroChart({ records }: CiroChartProps) {
  // Data processing: Aggregate total turnover by branch
  const dataMap = records.reduce((acc, record) => {
    const sube = record.sube_adi;
    acc[sube] = (acc[sube] || 0) + Number(record.tutar);
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(dataMap).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value);

  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

  return (
    <div className="glassmorphism p-6 rounded-2xl shadow-lg border border-border/50 h-[350px] md:h-[450px] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Şube Bazlı Ciro Dağılımı</h3>
          <p className="text-xs text-muted-foreground mt-1">Hangi şube ne kadar toplam tahsilat yaptı?</p>
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
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
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
