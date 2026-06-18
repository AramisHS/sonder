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
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Auditoría</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Registro completo de acciones del sistema</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por tabla, acción o usuario..." className="input pl-9" />
        </div>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input sm:w-48">
          <option value="all">Todas las acciones</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
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
                <th>Acción</th>
                <th>Tabla</th>
                <th>Usuario</th>
                <th className="text-right">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin registros de auditoría
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(log.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_COLORS[log.action] ?? 'badge-neutral'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{log.table_name}</td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{(log.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td className="text-right">
                      {(log.old_data || log.new_data) && (
                        <button onClick={() => setSelectedLog(log)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                          <Eye className="w-4 h-4" />
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

      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Detalles de auditoría" size="xl">
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>Acción</p>
                <span className={`badge ${ACTION_COLORS[selectedLog.action] ?? 'badge-neutral'}`}>{selectedLog.action}</span>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>Tabla</p>
                <p className="font-mono font-medium">{selectedLog.table_name}</p>
              </div>
            </div>
            {selectedLog.old_data && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Datos anteriores</p>
                <pre className="text-xs rounded-lg p-3 overflow-auto max-h-48" style={{ backgroundColor: 'var(--bg-error-subtle)', border: '1px solid var(--border-error)', color: 'var(--color-error-600)' }}>
                  {JSON.stringify(selectedLog.old_data, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.new_data && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Datos nuevos</p>
                <pre className="text-xs rounded-lg p-3 overflow-auto max-h-48" style={{ backgroundColor: 'var(--bg-success-subtle)', border: '1px solid var(--border-success)', color: 'var(--color-success-600)' }}>
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
