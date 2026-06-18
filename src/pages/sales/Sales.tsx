import { useState, useEffect } from 'react';
import { Receipt, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import type { Sale, SaleItem } from '../../lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailSale, setDetailSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    let query = supabase
      .from('sales')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    const { data } = await query;
    setSales(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, [dateFrom, dateTo]);

  const viewDetail = async (sale: Sale) => {
    setDetailLoading(true);
    const { data } = await supabase
      .from('sale_items')
      .select('*, products(name,unit)')
      .eq('sale_id', sale.id);
    setDetailSale({ ...sale, items: data ?? [] });
    setDetailLoading(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const filtered = sales.filter((s) =>
    [s.sale_number, (s.profiles as { full_name: string } | null)?.full_name].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalRevenue = filtered.reduce((s, sale) => s + sale.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Historial de ventas</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {filtered.length} ventas · Total: <span style={{ fontWeight: 600, color: '#0b3b4c' }}>{fmt(totalRevenue)}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o vendedor..."
            className="input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '140px' }}
          title="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '140px' }}
          title="Hasta"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Pago</th>
                <th>Descuento</th>
                <th>Total</th>
                <th style={{ textAlign: 'right' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Receipt style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin ventas registradas
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500 }}>{s.sale_number}</td>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(s.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: '#64748b' }}>{(s.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td>
                      <span className="badge badge-success">
                        {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>{s.discount > 0 ? fmt(s.discount) : '—'}</td>
                    <td style={{ fontWeight: 700, color: '#0b3b4c' }}>{fmt(s.total)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => viewDetail(s)}
                        style={{
                          padding: '0.375rem',
                          borderRadius: '0.5rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#0b3b4c'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <Eye style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!detailSale}
        onClose={() => setDetailSale(null)}
        title={`Detalle: ${detailSale?.sale_number ?? ''}`}
        size="lg"
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
          </div>
        ) : detailSale ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Fecha</p>
                <p style={{ fontWeight: 500 }}>{new Date(detailSale.created_at).toLocaleString('es-MX')}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Vendedor</p>
                <p style={{ fontWeight: 500 }}>{(detailSale.profiles as { full_name: string } | null)?.full_name ?? '—'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Método de pago</p>
                <p style={{ fontWeight: 500 }}>{PAYMENT_LABELS[detailSale.payment_method]}</p>
              </div>
              {detailSale.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Notas</p>
                  <p style={{ fontWeight: 500 }}>{detailSale.notes}</p>
                </div>
              )}
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSale.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{(item.products as { name: string } | null)?.name ?? '—'}</td>
                      <td>{item.quantity} {(item.products as { unit: string } | null)?.unit}</td>
                      <td>{fmt(item.unit_price)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Subtotal</span>
                <span>{fmt(detailSale.items.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              {detailSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Descuento</span>
                  <span style={{ color: '#dc2626' }}>-{fmt(detailSale.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', color: '#1e293b' }}>
                <span>Total</span>
                <span style={{ color: '#0b3b4c' }}>{fmt(detailSale.total)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}