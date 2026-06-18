import { useState, useEffect } from 'react';
import { ArrowLeftRight, Search, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { InventoryMovement } from '../../lib/types';

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
    let query = supabase
      .from('inventory_movements')
      .select('*, products(name,unit), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterType !== 'all') query = query.eq('movement_type', filterType);
    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    const { data } = await query;
    setMovements(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchMovements(); }, [filterType, dateFrom, dateTo]);

  const filtered = movements.filter((m) =>
    (m.products as { name: string } | null)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Historial de movimientos</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Todos los cambios de inventario</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="input pl-9" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input sm:w-44">
          <option value="all">Todos los tipos</option>
          <option value="entry">Entradas</option>
          <option value="sale">Ventas</option>
          <option value="adjustment">Ajustes</option>
          <option value="return">Devoluciones</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input sm:w-44" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input sm:w-44" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} /></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Stock anterior</th>
                <th>Stock nuevo</th>
                <th>Notas</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin movimientos
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const t = TYPE_LABELS[m.movement_type] ?? { label: m.movement_type, color: 'badge-neutral' };
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td><span className={`badge ${t.color}`}>{t.label}</span></td>
                      <td className="font-medium">{(m.products as { name: string } | null)?.name ?? '—'}</td>
                      <td>
                        <span className={`flex items-center gap-1 font-semibold`} style={{ color: isPositive ? 'var(--color-brand-600)' : 'var(--color-error-600)' }}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{m.quantity} {(m.products as { unit: string } | null)?.unit}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.stock_before}</td>
                      <td className="font-semibold">{m.stock_after}</td>
                      <td className="max-w-xs truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{m.notes ?? '—'}</td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(m.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
