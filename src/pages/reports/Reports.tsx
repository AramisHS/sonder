import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Loader2, TrendingUp, Package, DollarSign, ShoppingBag, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportSalesReportPDF } from '../../lib/pdf';

interface MonthlyData { month: string; total: number; count: number }
interface PaymentData { name: string; value: number }
interface TopProduct { name: string; qty: number; revenue: number }

const COLORS = ['#d97706', '#10b981', '#f59e0b', '#ef4444', '#c2583c', '#06b6d4'];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [inventorySummary, setInventorySummary] = useState({ totalValue: 0, totalSaleValue: 0, totalItems: 0, lowStock: 0 });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      const { data: salesData } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', start.toISOString());

      const months: Record<string, MonthlyData> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        months[key] = { month: key, total: 0, count: 0 };
      }
      (salesData ?? []).forEach((s) => {
        const d = new Date(s.created_at);
        const key = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        if (months[key]) {
          months[key].total += s.total;
          months[key].count += 1;
        }
      });
      setMonthly(Object.values(months));

      const { data: paymentRaw } = await supabase
        .from('sales')
        .select('payment_method, total');
      const payMap: Record<string, number> = {};
      const LABELS: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };
      (paymentRaw ?? []).forEach((s) => {
        const label = LABELS[s.payment_method] ?? s.payment_method;
        payMap[label] = (payMap[label] ?? 0) + s.total;
      });
      setPaymentData(Object.entries(payMap).map(([name, value]) => ({ name, value })));

      const { data: itemsRaw } = await supabase
        .from('sale_items')
        .select('quantity, subtotal, products(name)');
      const prodMap: Record<string, TopProduct> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (itemsRaw ?? []).forEach((item: any) => {
        const name = item.products?.name ?? 'Desconocido';
        if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 };
        prodMap[name].qty += item.quantity;
        prodMap[name].revenue += item.subtotal;
      });
      setTopProducts(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10));

      const { data: products } = await supabase
        .from('products')
        .select('stock, min_stock, purchase_price, sale_price')
        .eq('status', 'active');
      const summary = (products ?? []).reduce(
        (acc, p) => ({
          totalValue: acc.totalValue + p.stock * p.purchase_price,
          totalSaleValue: acc.totalSaleValue + p.stock * p.sale_price,
          totalItems: acc.totalItems + p.stock,
          lowStock: acc.lowStock + (p.stock <= p.min_stock ? 1 : 0),
        }),
        { totalValue: 0, totalSaleValue: 0, totalItems: 0, lowStock: 0 }
      );
      setInventorySummary(summary);

      setLoading(false);
    };
    load();
  }, []);

  const handlePDF = () => {
    exportSalesReportPDF(monthly, topProducts);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-brand-600)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reportes</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Analisis de ventas e inventario</p>
        </div>
        <button onClick={handlePDF} className="btn btn-secondary" title="Exportar PDF">
          <FileText className="w-4 h-4" /> PDF
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Valor de compra (inventario)', value: fmt(inventorySummary.totalValue), color: 'bg-brand-600' },
          { icon: DollarSign, label: 'Valor de venta (inventario)', value: fmt(inventorySummary.totalSaleValue), color: 'bg-emerald-600' },
          { icon: ShoppingBag, label: 'Unidades en stock', value: inventorySummary.totalItems.toFixed(0), color: 'bg-accent-600' },
          { icon: TrendingUp, label: 'Productos stock bajo', value: String(inventorySummary.lowStock), color: inventorySummary.lowStock > 0 ? 'bg-amber-500' : 'bg-gray-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color} mb-3`}>
              <kpi.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
            <p className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Ventas mensuales — ultimos 12 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value) => [fmt(Number(value ?? 0)), 'Ventas']}
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f9fafb' }}
            />
            <Bar dataKey="total" fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Metodos de pago</h2>
          {paymentData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f9fafb' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top 10 productos por ingresos</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin datos de ventas</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={80} />
                <Tooltip
                  formatter={(value) => [fmt(Number(value ?? 0)), 'Ingresos']}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f9fafb' }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {topProducts.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Detalle — top productos vendidos</h2>
          </div>
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Unidades vendidas</th>
                  <th>Ingresos totales</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td className="font-medium" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.qty.toFixed(2)}</td>
                    <td className="font-semibold" style={{ color: 'var(--color-success-600)' }}>{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
