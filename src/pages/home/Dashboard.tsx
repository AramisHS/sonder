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
        transition: 'box-shadow 0.2s, background 0.25s ease, border-color 0.25s ease',
        border: '1px solid var(--color-card-border)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bgColor,
          }}
        >
          <Icon style={{ width: '1.25rem', height: '1.25rem', color: '#ffffff' }} />
        </div>
      </div>
      <p style={{ marginTop: '0.75rem', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>
        {value}
      </p>
      <p style={{ marginTop: '0.125rem', fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
        {label}
      </p>
      {sub && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>{sub}</p>}
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
        <Loader2 style={{ width: '2rem', height: '2rem', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Dashboard</h1>
        <p style={{ fontSize: '0.875rem', marginTop: '0.125rem', color: 'var(--color-gray-500)' }}>
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
        <div style={{
          padding: '1.25rem',
          border: '1px solid var(--color-card-border)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-gray-800)' }}>
            Ventas — últimos 7 días
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-gray-400)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-gray-400)' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => [fmt(Number(value ?? 0)), 'Ventas']}
                contentStyle={{
                  backgroundColor: 'var(--color-sidebar-bg)',
                  border: '1px solid var(--color-card-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-gray-800)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '8px 12px',
                }}
              />
              <Bar dataKey="ventas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-gray-800)' }}>Top productos</h2>
            <button onClick={() => navigate('/reportes')} style={{
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--color-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
              Ver más <ArrowRight style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </div>
          {topProducts.length === 0 ? (
            <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0', color: 'var(--color-gray-400)' }}>
              Sin datos de ventas
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '1.25rem', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0, color: 'var(--color-gray-400)' }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-gray-800)' }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>{p.qty} unid.</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-gray-800)' }}>
                    {fmt(p.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{
          border: '1px solid var(--color-card-border)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-card-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle style={{ width: '1rem', height: '1rem', color: 'var(--color-warning)' }} />
              <h2 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-gray-800)' }}>
                Alertas de stock bajo ({lowStock.length})
              </h2>
            </div>
            <button onClick={() => navigate('/productos')} style={{
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--color-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
              Ver todos <ArrowRight style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              textAlign: 'left',
              fontSize: '0.875rem',
              borderCollapse: 'collapse',
              background: 'var(--color-card-bg)',
              transition: 'background 0.25s ease',
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-gray-500)',
                    background: 'var(--color-table-header)',
                    borderBottom: '1px solid var(--color-card-border)',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Producto
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-gray-500)',
                    background: 'var(--color-table-header)',
                    borderBottom: '1px solid var(--color-card-border)',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Categoría
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-gray-500)',
                    background: 'var(--color-table-header)',
                    borderBottom: '1px solid var(--color-card-border)',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Stock actual
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-gray-500)',
                    background: 'var(--color-table-header)',
                    borderBottom: '1px solid var(--color-card-border)',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Stock mínimo
                  </th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-gray-500)',
                    background: 'var(--color-table-header)',
                    borderBottom: '1px solid var(--color-card-border)',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-card-border)', fontWeight: 500, color: 'var(--color-gray-800)' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-gray-500)' }}>
                      {(p as { categories?: { name: string } }).categories?.name ?? '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-card-border)' }}>
                      <span style={{ fontWeight: 600, color: p.stock === 0 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-card-border)', color: 'var(--color-gray-500)' }}>
                      {p.min_stock} {p.unit}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-card-border)' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.125rem 0.625rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: p.stock === 0 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                        color: p.stock === 0 ? 'var(--color-error-text)' : 'var(--color-warning-text)',
                        transition: 'background 0.25s ease, color 0.25s ease',
                      }}>
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
        <button
          onClick={() => navigate('/categorias')}
          style={{
            padding: '1rem',
            border: '1px solid var(--color-card-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, background 0.25s ease, border-color 0.25s ease',
          }}
        >
          <Tag style={{ width: '2rem', height: '2rem', color: 'var(--color-secondary)' }} />
          <div>
            <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>
              {stats?.total_categories ?? 0}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>Categorías</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/proveedores')}
          style={{
            padding: '1rem',
            border: '1px solid var(--color-card-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, background 0.25s ease, border-color 0.25s ease',
          }}
        >
          <Truck style={{ width: '2rem', height: '2rem', color: 'var(--color-success)' }} />
          <div>
            <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>
              {stats?.total_suppliers ?? 0}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>Proveedores</p>
          </div>
        </button>
      </div>
    </div>
  );
}