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
    try {
      let query = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(1000);
      if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
      const { data: salesData } = await query;
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      const enriched = (salesData ?? []).map(sale => ({ ...sale, profiles: sale.created_by ? profileMap[sale.created_by] || null : null }));
      setSales(enriched);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, [dateFrom, dateTo]);

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
      const enrichedItems = (itemsData ?? []).map(item => ({ ...item, products: productMap[item.product_id] || null }));
      setDetailSale({ ...sale, items: enrichedItems });
    } catch (error) {
      console.error('Error fetching sale detail:', error);
    }
    setDetailLoading(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const totalRevenue = filtered.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Historial de ventas</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {filtered.length} ventas · Total: <span style={{ fontWeight: 600, color: '#059669' }}>{fmt(totalRevenue)}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número o vendedor..." className="input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" style={{ width: 'auto', minWidth: '140px' }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" style={{ width: 'auto', minWidth: '140px' }} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto',
          maxHeight: '100%',
          minHeight: 0,
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
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
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Número</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Fecha</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Vendedor</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Pago</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Descuento</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Total</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Receipt style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin ventas
                  </td></tr>
                ) : (
                  paginatedItems.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500 }}>{s.sale_number}</td>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{new Date(s.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ color: '#64748b' }}>{(s.profiles as Profile | null)?.full_name ?? '—'}</td>
                      <td><span className="badge-brand">{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</span></td>
                      <td style={{ color: '#64748b' }}>{s.discount > 0 ? fmt(s.discount) : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{fmt(s.total)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => viewDetail(s)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                          <Eye style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </td>
                    </tr>
                  ))
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
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
          </div>
        ) : detailSale ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div><p style={{ color: '#64748b' }}>Fecha</p><p style={{ fontWeight: 500 }}>{new Date(detailSale.created_at).toLocaleString('es-MX')}</p></div>
              <div><p style={{ color: '#64748b' }}>Vendedor</p><p style={{ fontWeight: 500 }}>{(detailSale.profiles as Profile | null)?.full_name ?? '—'}</p></div>
              <div><p style={{ color: '#64748b' }}>Método de pago</p><p style={{ fontWeight: 500 }}>{PAYMENT_LABELS[detailSale.payment_method]}</p></div>
              {detailSale.notes && <div style={{ gridColumn: 'span 2' }}><p style={{ color: '#64748b' }}>Notas</p><p style={{ fontWeight: 500 }}>{detailSale.notes}</p></div>}
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {detailSale.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{(item.products as Product | null)?.name ?? '—'}</td>
                      <td>{item.quantity} {(item.products as Product | null)?.unit}</td>
                      <td>{fmt(item.unit_price)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>Subtotal</span><span>{fmt(detailSale.items.reduce((s, i) => s + i.subtotal, 0))}</span></div>
              {detailSale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>Descuento</span><span style={{ color: '#dc2626' }}>-{fmt(detailSale.discount)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}><span>Total</span><span style={{ color: '#059669' }}>{fmt(detailSale.total)}</span></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}