import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Package, AlertTriangle, TrendingUp, ShoppingCart,
  Tag, Truck, ArrowRight, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DashboardStats, Product } from '../../lib/types';

interface DailyData {
  date: string;
  ventas: number;
  pedidos: number;
}

interface TopProduct {
  name: string;
  total: number;
  qty: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  bgColor,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  bgColor: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '1.25rem',
        textAlign: 'left',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        border: '1px solid #edf2f7',
        borderRadius: '1rem',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bgColor,
          }}
        >
          <Icon style={{ width: '1.25rem', height: '1.25rem', color: '#ffffff' }} />
        </div>
      </div>
      <p style={{ marginTop: '0.75rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
        {value}
      </p>
      <p style={{ marginTop: '0.125rem', fontSize: '0.875rem', color: '#64748b' }}>
        {label}
      </p>
      {sub && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>{sub}</p>}
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: statsData } = await supabase.rpc('get_dashboard_stats');
      if (statsData) setStats(statsData as DashboardStats);

      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const { data: salesData } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', start.toISOString());

      const days: Record<string, DailyData> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        days[key] = { date: key, ventas: 0, pedidos: 0 };
      }
      (salesData ?? []).forEach((s) => {
        const d = new Date(s.created_at);
        const key = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        if (days[key]) {
          days[key].ventas += s.total;
          days[key].pedidos += 1;
        }
      });
      setDailyData(Object.values(days));

      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('quantity, subtotal, products(name)')
        .order('subtotal', { ascending: false })
        .limit(100);

      const prodMap: Record<string, TopProduct> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (saleItems ?? []).forEach((item: any) => {
        const name = item.products?.name ?? 'Desconocido';
        if (!prodMap[name]) prodMap[name] = { name, total: 0, qty: 0 };
        prodMap[name].total += item.subtotal;
        prodMap[name].qty += item.quantity;
      });
      const top = Object.values(prodMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopProducts(top);

      const { data: productsData } = await supabase
        .from('products')
        .select('*, categories(name), suppliers(name)')
        .eq('status', 'active')
        .order('stock');
      const low = (productsData ?? []).filter((p) => p.stock <= p.min_stock);
      setLowStock(low.slice(0, 8));

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
        <Loader2 style={{ width: '2rem', height: '2rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Dashboard</h1>
        <p style={{ fontSize: '0.875rem', marginTop: '0.125rem', color: '#64748b' }}>
          Resumen del negocio — {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%' }}>
        <StatCard
          icon={TrendingUp}
          label="Ventas hoy"
          value={fmt(stats?.total_sales_today ?? 0)}
          sub={`${stats?.sales_count_today ?? 0} transacciones`}
          bgColor="#0b3b4c"
          onClick={() => navigate('/ventas')}
        />
        <StatCard
          icon={ShoppingCart}
          label="Ventas del mes"
          value={fmt(stats?.total_sales_month ?? 0)}
          sub={`${stats?.sales_count_month ?? 0} transacciones`}
          bgColor="#059669"
          onClick={() => navigate('/ventas')}
        />
        <StatCard
          icon={Package}
          label="Productos activos"
          value={stats?.total_products ?? 0}
          sub={`${stats?.total_categories ?? 0} categorías`}
          bgColor="#b8860b"
          onClick={() => navigate('/productos')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock bajo"
          value={stats?.low_stock_count ?? 0}
          sub="Requieren atención"
          bgColor={stats?.low_stock_count ? '#d97706' : '#94a3b8'}
          onClick={() => navigate('/productos')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', width: '100%' }}>
        {/* Sales Chart */}
        <div style={{ padding: '1.25rem', border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>Ventas — últimos 7 días</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => [fmt(Number(value ?? 0)), 'Ventas']}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }}
              />
              <Bar dataKey="ventas" fill="#0b3b4c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div style={{ padding: '1.25rem', border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>Top productos</h2>
            <button onClick={() => navigate('/reportes')} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0b3b4c', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver más <ArrowRight style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </div>
          {topProducts.length === 0 ? (
            <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>Sin datos de ventas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '1.25rem', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0, color: '#94a3b8' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>{p.name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.qty} unid.</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1e293b' }}>{fmt(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{ border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#d97706' }} />
              <h2 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                Alertas de stock bajo ({lowStock.length})
              </h2>
            </div>
            <button onClick={() => navigate('/productos')} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0b3b4c', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver todos <ArrowRight style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>Producto</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>Categoría</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>Stock actual</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>Stock mínimo</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{(p as { categories?: { name: string } }).categories?.name ?? '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: 600, color: p.stock === 0 ? '#dc2626' : '#d97706' }}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{p.min_stock} {p.unit}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, background: p.stock === 0 ? '#fef2f2' : '#fef3c7', color: p.stock === 0 ? '#991b1b' : '#92400e' }}>
                        {p.stock === 0 ? 'Sin stock' : 'Stock bajo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '100%' }}>
        <button onClick={() => navigate('/categorias')} style={{ padding: '1rem', border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
          <Tag style={{ width: '2rem', height: '2rem', color: '#b8860b' }} />
          <div>
            <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b' }}>{stats?.total_categories ?? 0}</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Categorías</p>
          </div>
        </button>
        <button onClick={() => navigate('/proveedores')} style={{ padding: '1rem', border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
          <Truck style={{ width: '2rem', height: '2rem', color: '#059669' }} />
          <div>
            <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b' }}>{stats?.total_suppliers ?? 0}</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Proveedores</p>
          </div>
        </button>
      </div>
    </div>
  );
}