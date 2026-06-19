import { useState, useEffect } from 'react';
import { ClipboardList, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { AuditLog as AuditLogType, Profile } from '../../lib/types';

// Traducción de acciones
const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Registro',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  SALE: 'Venta',
  INVENTORY_ENTRY: 'Entrada de inventario',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
};

// Colores para acciones
const ACTION_COLORS: Record<string, string> = {
  INSERT: 'badge-success',
  UPDATE: 'badge-warning',
  DELETE: 'badge-error',
  SALE: 'badge-brand',
  INVENTORY_ENTRY: 'badge-info',
  INVENTORY_ADJUSTMENT: 'badge-warning',
};

// Traducción de tablas → secciones
const TABLE_LABELS: Record<string, string> = {
  cash_register_closings: 'Corte de Caja',
  sales: 'Nueva Venta',
  products: 'Productos',
  categories: 'Categorías',
  suppliers: 'Proveedores',
  profiles: 'Usuarios',
  inventory_entries: 'Entradas de inventario',
  inventory_adjustments: 'Ajustes de inventario',
  inventory_movements: 'Movimientos de inventario',
  audit_log: 'Auditoría',
  sale_items: 'Ítems de venta',
};

// Traducción de campos para el detalle
const FIELD_LABELS: Record<string, string> = {
  notes: 'Notas',
  card_total: 'Total Tarjeta',
  cash_total: 'Total Efectivo',
  transfer_total: 'Total Transferencia',
  created_at: 'Fecha de creación',
  sales_count: 'Número de ventas',
  total_sales: 'Total ventas',
  closing_date: 'Fecha de corte',
  full_name: 'Responsable',
  name: 'Nombre',
  description: 'Descripción',
  active: 'Activo',
  role: 'Rol',
  purchase_price: 'Precio de compra',
  sale_price: 'Precio de venta',
  stock: 'Stock',
  min_stock: 'Stock mínimo',
  unit: 'Unidad',
  status: 'Estado',
  barcode: 'Código de barras',
  email: 'Email',
  phone: 'Teléfono',
  address: 'Dirección',
  contact_name: 'Nombre de contacto',
  quantity: 'Cantidad',
  subtotal: 'Subtotal',
  unit_price: 'Precio unitario',
  payment_method: 'Método de pago',
  discount: 'Descuento',
  total: 'Total',
  sale_number: 'Número de venta',
  movement_type: 'Tipo de movimiento',
  quantity_before: 'Stock anterior',
  quantity_after: 'Stock nuevo',
  reason: 'Motivo',
};

const ALL_ACTIONS = ['INSERT', 'UPDATE', 'DELETE', 'SALE', 'INVENTORY_ENTRY', 'INVENTORY_ADJUSTMENT'];

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key === 'created_at' || key === 'closing_date' || key === 'updated_at') {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }
  if (typeof value === 'number' &&
    (key === 'total' || key === 'total_sales' || key === 'cash_total' ||
      key === 'transfer_total' || key === 'card_total' || key === 'subtotal' ||
      key === 'unit_price' || key === 'purchase_price' || key === 'sale_price')) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const [selectedLog, setSelectedLog] = useState<AuditLogType | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
      if (filterAction !== 'all') query = query.eq('action', filterAction);
      const { data: auditData } = await query;
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      const enriched = (auditData ?? []).map(log => ({
        ...log,
        profiles: log.user_id ? profileMap[log.user_id] || null : null,
      }));
      setLogs(enriched);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const filtered = logs.filter((l) =>
    [l.table_name, l.action, (l.profiles as Profile | null)?.full_name].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

  const getDisplayData = (data: any) => {
    if (!data) return null;
    const excludeKeys = ['id', 'created_by', 'user_id', 'profile_id', 'product_id', 'category_id', 'supplier_id', 'sale_id'];
    const entries = Object.entries(data)
      .filter(([key]) => !excludeKeys.includes(key) && !key.startsWith('_'))
      .map(([key, value]) => ({
        label: FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: formatValue(key, value),
      }));
    return entries;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Auditoría</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>{filtered.length} registros</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-gray-400)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por sección, acción o usuario..."
            className="input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="all">Todas las acciones</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
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
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>
                    Hora
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>
                    Acción
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>
                    Sección
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>
                    Usuario
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, textAlign: 'center', transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-gray-400)' }}>
                    <ClipboardList style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin registros
                  </td></tr>
                ) : (
                  paginatedItems.map((log) => {
                    const actionLabel = ACTION_LABELS[log.action] || log.action;
                    const actionColor = ACTION_COLORS[log.action] || 'badge-neutral';
                    const sectionLabel = TABLE_LABELS[log.table_name] || log.table_name;
                    return (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                          {new Date(log.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td>
                          <span className={`badge ${actionColor}`} style={{ minWidth: '7rem', display: 'inline-block', textAlign: 'center' }}>
                            {actionLabel}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>{sectionLabel}</td>
                        <td style={{ color: 'var(--color-gray-500)' }}>{(log.profiles as Profile | null)?.full_name ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {(log.old_data || log.new_data) && (
                            <button
                              onClick={() => setSelectedLog(log)}
                              style={{
                                padding: '0.375rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-gray-400)',
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                              title="Ver detalles"
                            >
                              <Eye style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={5} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
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

      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Detalles de auditoría" size="lg">
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Encabezado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gray-500)' }}>
                  Acción
                </p>
                <span className={`badge ${ACTION_COLORS[selectedLog.action] || 'badge-neutral'}`} style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem' }}>
                  {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                </span>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gray-500)' }}>
                  Sección
                </p>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-gray-800)' }}>
                  {TABLE_LABELS[selectedLog.table_name] || selectedLog.table_name}
                </p>
              </div>
            </div>

            {/* Datos nuevos */}
            {selectedLog.new_data && (
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gray-500)', marginBottom: '0.5rem' }}>
                  Datos nuevos
                </p>
                <div style={{
                  border: '1px solid var(--color-card-border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--color-card-bg)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <tbody>
                      {getDisplayData(selectedLog.new_data)?.map(({ label, value }, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < (getDisplayData(selectedLog.new_data)?.length || 0) - 1 ? '1px solid var(--color-card-border)' : 'none' }}>
                          <td style={{
                            padding: '0.4rem 0.75rem',
                            fontWeight: 500,
                            color: 'var(--color-gray-600)',
                            background: 'var(--color-gray-100)',
                            width: '40%',
                            transition: 'background 0.25s ease, color 0.25s ease',
                          }}>
                            {label}
                          </td>
                          <td style={{
                            padding: '0.4rem 0.75rem',
                            color: 'var(--color-gray-800)',
                            transition: 'color 0.25s ease',
                          }}>
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Datos anteriores */}
            {selectedLog.old_data && (
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gray-500)', marginBottom: '0.5rem' }}>
                  Datos anteriores
                </p>
                <div style={{
                  border: '1px solid var(--color-card-border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--color-card-bg)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <tbody>
                      {getDisplayData(selectedLog.old_data)?.map(({ label, value }, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < (getDisplayData(selectedLog.old_data)?.length || 0) - 1 ? '1px solid var(--color-card-border)' : 'none' }}>
                          <td style={{
                            padding: '0.4rem 0.75rem',
                            fontWeight: 500,
                            color: 'var(--color-gray-600)',
                            background: 'var(--color-gray-100)',
                            width: '40%',
                            transition: 'background 0.25s ease, color 0.25s ease',
                          }}>
                            {label}
                          </td>
                          <td style={{
                            padding: '0.4rem 0.75rem',
                            color: 'var(--color-gray-800)',
                            transition: 'color 0.25s ease',
                          }}>
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}