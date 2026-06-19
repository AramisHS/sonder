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

const COLORS = ['#0b3b4c', '#059669', '#d97706', '#dc2626', '#b8860b', '#0ea5e9'];

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
        <Loader2 style={{ width: '2rem', height: '2rem', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const kpis = [
    { icon: Package, label: 'Valor de compra (inventario)', value: fmt(inventorySummary.totalValue), bg: '#0b3b4c' },
    { icon: TrendingUp, label: 'Productos stock bajo', value: String(inventorySummary.lowStock), bg: inventorySummary.lowStock > 0 ? '#d97706' : '#94a3b8' },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.5rem', 
      width: '100%',
      minHeight: 'calc(100vh - 8rem)',
      paddingBottom: '2rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Reportes</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>Análisis de ventas e inventario</p>
        </div>
        <button
          onClick={handlePDF}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-gray-100)',
            color: 'var(--color-gray-700)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.875rem',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-gray-200)';
            e.currentTarget.style.color = 'var(--color-gray-900)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-gray-100)';
            e.currentTarget.style.color = 'var(--color-gray-700)';
          }}
        >
          <FileText style={{ width: '1rem', height: '1rem' }} /> PDF
        </button>
      </div>

      {/* KPI Cards (solo 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%' }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ 
            padding: '1.25rem', 
            border: '1px solid var(--color-card-border)', 
            borderRadius: 'var(--radius-xl)', 
            background: 'var(--color-card-bg)', 
            boxShadow: 'var(--shadow-sm)',
            transition: 'background 0.25s ease, border-color 0.25s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', background: kpi.bg }}>
              <kpi.icon style={{ width: '1rem', height: '1rem', color: '#ffffff' }} />
            </div>
            <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>{kpi.value}</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.125rem', lineHeight: 1.3, color: 'var(--color-gray-500)' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Sales Chart */}
      <div style={{ 
        padding: '1.25rem', 
        border: '1px solid var(--color-card-border)', 
        borderRadius: 'var(--radius-xl)', 
        background: 'var(--color-card-bg)', 
        boxShadow: 'var(--shadow-sm)',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-gray-800)' }}>Ventas mensuales — últimos 12 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-gray-400)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-gray-400)' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value) => [fmt(Number(value ?? 0)), 'Ventas']}
              contentStyle={{ 
                backgroundColor: 'var(--color-card-bg)', 
                border: '1px solid var(--color-card-border)', 
                borderRadius: 'var(--radius-md)', 
                color: 'var(--color-gray-800)',
              }}
            />
            <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
        {/* Payment Methods */}
        <div style={{ 
          padding: '1.25rem', 
          border: '1px solid var(--color-card-border)', 
          borderRadius: 'var(--radius-xl)', 
          background: 'var(--color-card-bg)', 
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-gray-800)' }}>Métodos de pago</h2>
          {paymentData.length === 0 ? (
            <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0', color: 'var(--color-gray-400)' }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  formatter={(v) => fmt(Number(v ?? 0))} 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card-bg)', 
                    border: '1px solid var(--color-card-border)', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'var(--color-gray-800)',
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products */}
        <div style={{ 
          padding: '1.25rem', 
          border: '1px solid var(--color-card-border)', 
          borderRadius: 'var(--radius-xl)', 
          background: 'var(--color-card-bg)', 
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-gray-800)' }}>Top 10 productos por ingresos</h2>
          {topProducts.length === 0 ? (
            <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0', color: 'var(--color-gray-400)' }}>Sin datos de ventas</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-gray-400)' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-gray-400)' }} width={80} />
                <Tooltip
                  formatter={(value) => [fmt(Number(value ?? 0)), 'Ingresos']}
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card-bg)', 
                    border: '1px solid var(--color-card-border)', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'var(--color-gray-800)',
                  }}
                />
                <Bar dataKey="revenue" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Products Detail Table - Más grande (7 filas visibles) con scroll interno */}
      {topProducts.length > 0 && (
        <div style={{ 
          border: '1px solid var(--color-card-border)', 
          borderRadius: 'var(--radius-xl)', 
          background: 'var(--color-card-bg)', 
          boxShadow: 'var(--shadow-sm)', 
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--color-card-border)' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gray-800)' }}>Detalle — top productos vendidos</h2>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '280px' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontWeight: 500, 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    color: 'var(--color-gray-500)', 
                    background: 'var(--color-table-header)', 
                    borderBottom: '1px solid var(--color-card-border)',
                  }}>#</th>
                  <th style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontWeight: 500, 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    color: 'var(--color-gray-500)', 
                    background: 'var(--color-table-header)', 
                    borderBottom: '1px solid var(--color-card-border)',
                  }}>Producto</th>
                  <th style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontWeight: 500, 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    color: 'var(--color-gray-500)', 
                    background: 'var(--color-table-header)', 
                    borderBottom: '1px solid var(--color-card-border)',
                  }}>Unidades</th>
                  <th style={{ 
                    padding: '0.5rem 0.75rem', 
                    fontWeight: 500, 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    color: 'var(--color-gray-500)', 
                    background: 'var(--color-table-header)', 
                    borderBottom: '1px solid var(--color-card-border)',
                  }}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-gray-500)' }}>{i + 1}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-card-border)', fontWeight: 500, color: 'var(--color-gray-800)' }}>{p.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-gray-800)' }}>{p.qty.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-card-border)', fontWeight: 600, color: 'var(--color-success-text)' }}>{fmt(p.revenue)}</td>
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