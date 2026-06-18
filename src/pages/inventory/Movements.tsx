import { useState, useEffect } from 'react';
import { ArrowLeftRight, Search, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { InventoryMovement, Product, Profile } from '../../lib/types';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  entry: { label: 'Entrada', color: 'badge-brand' },
  sale: { label: 'Venta', color: 'badge-success' },
  adjustment: { label: 'Ajuste', color: 'badge-warning' },
  return: { label: 'Devolución', color: 'badge-info' },
};

export default function Movements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchMovements = async () => {
    setLoading(true);
    try {
      let query = supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(1000);
      if (filterType !== 'all') query = query.eq('movement_type', filterType);
      if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
      const { data: movementsData } = await query;
      const { data: productsData } = await supabase.from('products').select('id, name, unit');
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');

      const productMap = Object.fromEntries((productsData ?? []).map(p => [p.id, p]));
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));

      const enriched = (movementsData ?? []).map(m => ({
        ...m,
        products: productMap[m.product_id] || null,
        profiles: m.created_by ? profileMap[m.created_by] || null : null,
      }));

      setMovements(enriched);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMovements(); }, [filterType, dateFrom, dateTo]);

  const filtered = movements.filter((m) =>
    (m.products as Product | null)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Historial de movimientos</h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{filtered.length} registros</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="all">Todos los tipos</option>
          <option value="entry">Entradas</option>
          <option value="sale">Ventas</option>
          <option value="adjustment">Ajustes</option>
          <option value="return">Devoluciones</option>
        </select>
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
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Fecha</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Tipo</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Producto</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Cantidad</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Stock anterior</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Stock nuevo</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Notas</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <ArrowLeftRight style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin movimientos
                  </td></tr>
                ) : (
                  paginatedItems.map((m) => {
                    const t = TYPE_LABELS[m.movement_type] ?? { label: m.movement_type, color: 'badge-neutral' };
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} style={{ height: '56px' }}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td><span className={`badge ${t.color}`}>{t.label}</span></td>
                        <td style={{ fontWeight: 500 }}>{(m.products as Product | null)?.name ?? '—'}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, color: isPositive ? '#0b3b4c' : '#dc2626' }}>
                            {isPositive ? <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} /> : <TrendingDown style={{ width: '0.75rem', height: '0.75rem' }} />}
                            {isPositive ? '+' : ''}{m.quantity} {(m.products as Product | null)?.unit}
                          </span>
                        </td>
                        <td style={{ color: '#64748b' }}>{m.stock_before}</td>
                        <td style={{ fontWeight: 600 }}>{m.stock_after}</td>
                        <td style={{ maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#64748b' }}>{m.notes ?? '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{(m.profiles as Profile | null)?.full_name ?? '—'}</td>
                      </tr>
                    );
                  })
                )}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={8} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
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
    </div>
  );
}