import { useState, useEffect } from 'react';
import { ClipboardList, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import type { AuditLog as AuditLogType } from '../../lib/types';

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'badge-brand',
  UPDATE: 'badge-warning',
  DELETE: 'badge-error',
  SALE: 'badge-success',
  INVENTORY_ENTRY: 'badge-info',
  INVENTORY_ADJUSTMENT: 'badge-warning',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogType | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    const { data } = await query;
    setLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filterAction, dateFrom, dateTo]);

  const filtered = logs.filter((l) =>
    [l.table_name, l.action, (l.profiles as { full_name: string } | null)?.full_name].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const actions = [...new Set(logs.map((l) => l.action))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Auditoría</h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Registro completo de acciones del sistema</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tabla, acción o usuario..."
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
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '140px' }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '140px' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Tabla</th>
                <th>Usuario</th>
                <th style={{ textAlign: 'right' }}>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <ClipboardList style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin registros de auditoría
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(log.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_COLORS[log.action] ?? 'badge-neutral'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{log.table_name}</td>
                    <td style={{ color: '#64748b' }}>{(log.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {(log.old_data || log.new_data) && (
                        <button
                          onClick={() => setSelectedLog(log)}
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
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Detalles de auditoría" size="xl">
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <p style={{ color: '#64748b' }}>Acción</p>
                <span className={`badge ${ACTION_COLORS[selectedLog.action] ?? 'badge-neutral'}`}>
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <p style={{ color: '#64748b' }}>Tabla</p>
                <p style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{selectedLog.table_name}</p>
              </div>
            </div>
            {selectedLog.old_data && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem', color: '#64748b' }}>Datos anteriores</p>
                <pre style={{ fontSize: '0.75rem', borderRadius: '0.5rem', padding: '0.75rem', overflow: 'auto', maxHeight: '12rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
                  {JSON.stringify(selectedLog.old_data, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.new_data && (
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem', color: '#64748b' }}>Datos nuevos</p>
                <pre style={{ fontSize: '0.75rem', borderRadius: '0.5rem', padding: '0.75rem', overflow: 'auto', maxHeight: '12rem', background: '#d1fae5', border: '1px solid #a7f3d0', color: '#065f46' }}>
                  {JSON.stringify(selectedLog.new_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}