import { useState, useEffect } from 'react';
import { Receipt, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { Sale, SaleItem, Profile, Product } from '../../lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

const PAYMENT_STYLES: Record<string, { bg: string; color: string }> = {
  efectivo: { bg: '#0b3b4c', color: '#ffffff' },     
  tarjeta: { bg: '#7c3aed', color: '#ffffff' },     
  transferencia: { bg: '#0e7490', color: '#ffffff' },
  otro: { bg: '#64748b', color: '#ffffff' },         
};

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [detailSale, setDetailSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const date = new Date(selectedDate + 'T00:00:00');
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const startISO = start.toISOString();
      const endISO = end.toISOString();

      let query = supabase
        .from('sales')
        .select('*')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(1000);

      const { data: salesData } = await query;
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      const enriched = (salesData ?? []).map(sale => ({
        ...sale,
        profiles: sale.created_by ? profileMap[sale.created_by] || null : null,
      }));
      setSales(enriched);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, [selectedDate]);

  const filtered = sales.filter((s) =>
    [s.sale_number, (s.profiles as Profile | null)?.full_name].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

  const viewDetail = async (sale: Sale) => {
    setDetailLoading(true);
    try {
      const { data: itemsData } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      const { data: productsData } = await supabase.from('products').select('id, name, unit');
      const productMap = Object.fromEntries((productsData ?? []).map(p => [p.id, p]));
      const enrichedItems = (itemsData ?? []).map(item => ({
        ...item,
        products: productMap[item.product_id] || null,
      }));
      setDetailSale({ ...sale, items: enrichedItems });
    } catch (error) {
      console.error('Error fetching sale detail:', error);
    }
    setDetailLoading(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const totalRevenue = filtered.reduce((sum, sale) => sum + sale.total, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Historial de ventas</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
            {filtered.length} ventas · Total: <span style={{ fontWeight: 600, color: 'var(--color-success-text)' }}>{fmt(totalRevenue)}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-gray-400)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o vendedor..."
            className="input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-gray-500)' }}>Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: '160px' }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto',
          maxHeight: '100%',
          minHeight: 0,
          border: '1px solid var(--color-card-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--color-card-bg)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Número</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Fecha</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Vendedor</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Pago</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Descuento</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Total</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, textAlign: 'right', transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-gray-400)' }}>
                      <Receipt style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                      Sin ventas para esta fecha
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((s) => {
                    const paymentStyle = PAYMENT_STYLES[s.payment_method] || PAYMENT_STYLES.otro;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-gray-800)' }}>
                          {s.sale_number}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--color-gray-500)' }}>
                          {formatDate(s.created_at)}
                        </td>
                        <td style={{ color: 'var(--color-gray-500)' }}>
                          {(s.profiles as Profile | null)?.full_name ?? '—'}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: paymentStyle.bg,
                              color: paymentStyle.color,
                              minWidth: '7rem',
                              display: 'inline-block',
                              textAlign: 'center',
                              fontWeight: 500,
                              padding: '0.125rem 0.625rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              transition: 'background 0.25s ease, color 0.25s ease',
                            }}
                          >
                            {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-gray-500)' }}>
                          {s.discount > 0 ? fmt(s.discount) : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--color-success-text)' }}>
                          {fmt(s.total)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => viewDetail(s)}
                            style={{
                              padding: '0.375rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-gray-400)',
                              cursor: 'pointer',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                          >
                            <Eye style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={7} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      </div>

      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title={`Detalle: ${detailSale?.sale_number ?? ''}`} size="lg">
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          </div>
        ) : detailSale ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <p style={{ color: 'var(--color-gray-500)' }}>Fecha</p>
                <p style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                  {new Date(detailSale.created_at).toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--color-gray-500)' }}>Vendedor</p>
                <p style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                  {(detailSale.profiles as Profile | null)?.full_name ?? '—'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--color-gray-500)' }}>Método de pago</p>
                <p style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                  {PAYMENT_LABELS[detailSale.payment_method]}
                </p>
              </div>
              {detailSale.notes && (
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ color: 'var(--color-gray-500)' }}>Notas</p>
                  <p style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>{detailSale.notes}</p>
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
                      <td style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                        {(item.products as Product | null)?.name ?? '—'}
                      </td>
                      <td style={{ color: 'var(--color-gray-800)' }}>
                        {item.quantity} {(item.products as Product | null)?.unit}
                      </td>
                      <td style={{ color: 'var(--color-gray-800)' }}>{fmt(item.unit_price)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-gray-500)' }}>
                <span>Subtotal</span>
                <span>{fmt(detailSale.items.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              {detailSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-gray-500)' }}>
                  <span>Descuento</span>
                  <span style={{ color: 'var(--color-error)' }}>-{fmt(detailSale.discount)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderTop: '1px solid var(--color-card-border)',
                  paddingTop: '0.5rem',
                  marginTop: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--color-gray-800)' }}>Total</span>
                <span style={{ color: 'var(--color-success-text)' }}>{fmt(detailSale.total)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}