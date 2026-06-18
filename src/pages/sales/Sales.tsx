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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Historial de ventas</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} ventas · Total: <span className="font-semibold" style={{ color: 'var(--color-success-600)' }}>{fmt(totalRevenue)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número o vendedor..." className="input pl-9" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input sm:w-44" title="Desde" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input sm:w-44" title="Hasta" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} /></div>
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
                <th className="text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin ventas registradas
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-medium">{s.sale_number}</td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(s.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(s.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td>
                      <span className="badge-brand">
                        {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.discount > 0 ? fmt(s.discount) : '—'}</td>
                    <td className="font-bold" style={{ color: 'var(--color-success-600)' }}>{fmt(s.total)}</td>
                    <td className="text-right">
                      <button
                        onClick={() => viewDetail(s)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Eye className="w-4 h-4" />
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
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} /></div>
        ) : detailSale ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>Fecha</p>
                <p className="font-medium">{new Date(detailSale.created_at).toLocaleString('es-MX')}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>Vendedor</p>
                <p className="font-medium">{(detailSale.profiles as { full_name: string } | null)?.full_name ?? '—'}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>Método de pago</p>
                <p className="font-medium">{PAYMENT_LABELS[detailSale.payment_method]}</p>
              </div>
              {detailSale.notes && (
                <div className="col-span-2">
                  <p style={{ color: 'var(--text-secondary)' }}>Notas</p>
                  <p className="font-medium">{detailSale.notes}</p>
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
                      <td className="font-medium">{(item.products as { name: string } | null)?.name ?? '—'}</td>
                      <td>{item.quantity} {(item.products as { unit: string } | null)?.unit}</td>
                      <td>{fmt(item.unit_price)}</td>
                      <td className="font-semibold">{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>{fmt(detailSale.items.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              {detailSale.discount > 0 && (
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>Descuento</span>
                  <span style={{ color: 'var(--color-error-500)' }}>-{fmt(detailSale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1.5" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-success-600)' }}>{fmt(detailSale.total)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
