import { useState, useEffect } from 'react';
import { Calculator, Loader2, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { logAudit } from '../../lib/audit';
import { exportCashClosingPDF } from '../../lib/pdf';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';

interface ClosingRow {
  id: string;
  closing_date: string;
  total_sales: number;
  cash_total: number;
  transfer_total: number;
  card_total: number;
  sales_count: number;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export default function CashRegisterClosing() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const fetchClosings = async () => {
    setLoading(true);
    try {
      const { data: closingsData } = await supabase
        .from('cash_register_closings')
        .select('*')
        .order('closing_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      const enriched = (closingsData ?? []).map(c => ({
        ...c,
        profiles: c.created_by ? profileMap[c.created_by] || null : null,
      }));
      setClosings(enriched);
    } catch (error) {
      console.error('Error fetching closings:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClosings();
  }, []);

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(closings, PAGE_SIZE);

  const handleClosing = async () => {
    if (!profile) return;
    setSaving(true);

    // ✅ Usar la función RPC que ignora RLS
    const { data, error } = await supabase.rpc('get_cash_closing', {
      p_date: closingDate,
    });

    if (error) {
      alert('Error al calcular el corte: ' + error.message);
      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      alert('No se encontraron ventas para esta fecha.');
      setSaving(false);
      return;
    }

    const result = data[0];
    const { total_sales, cash_total, transfer_total, card_total, sales_count } = result;

    const { data: created, error: insertError } = await supabase
      .from('cash_register_closings')
      .insert({
        closing_date: closingDate,
        total_sales: total_sales,
        cash_total: cash_total,
        transfer_total: transfer_total,
        card_total: card_total,
        sales_count: sales_count,
        notes: notes || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      alert('Error al guardar el corte: ' + insertError.message);
      setSaving(false);
      return;
    }

    if (created) {
      await logAudit(profile.id, 'INSERT', 'cash_register_closings', created.id, null, created);
    }

    setSaving(false);
    setNotes('');
    fetchClosings();
  };

  const handlePDF = (row: ClosingRow) => exportCashClosingPDF(row);

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('¿Eliminar este corte de caja? Esta acción no se puede deshacer.')) return;
    await supabase.from('cash_register_closings').delete().eq('id', id);
    fetchClosings();
  };

  const maxDate = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Corte de Caja</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
          {closings.length} cortes registrados
        </p>
      </div>

      {/* Formulario de corte */}
      <div
        style={{
          padding: '1.25rem',
          border: '1px solid var(--color-card-border)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-card-bg)',
          flexShrink: 0,
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Calculator style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-gray-800)' }}>Realizar corte</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label className="label">Fecha del corte</label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              max={maxDate}
              className="input"
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label className="label">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del día..."
              className="input"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleClosing}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = 'var(--color-primary-dark)';
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = 'var(--color-primary)';
              }}
            >
              {saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}
              Realizar corte
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de cortes */}
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
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Fecha</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Creado</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Total ventas</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Efectivo</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Transferencia</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Tarjeta</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>No. Ventas</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Responsable</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, textAlign: 'center', transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>PDF</th>
                  {isAdmin && (
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-table-header)', zIndex: 1, textAlign: 'center', transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease' }}>Eliminar</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-gray-400)' }}>
                      <Calculator style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                      Sin cortes
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                        {new Date(c.closing_date + 'T12:00:00').toLocaleDateString('es-MX')}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                        {new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        {fmt(c.total_sales)}
                      </td>
                      <td style={{ color: 'var(--color-gray-800)' }}>{fmt(c.cash_total)}</td>
                      <td style={{ color: 'var(--color-gray-800)' }}>{fmt(c.transfer_total)}</td>
                      <td style={{ color: 'var(--color-gray-800)' }}>{fmt(c.card_total)}</td>
                      <td style={{ color: 'var(--color-gray-800)' }}>{c.sales_count}</td>
                      <td style={{ color: 'var(--color-gray-500)' }}>
                        {(c.profiles as { full_name: string } | null)?.full_name ?? '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handlePDF(c)}
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
                        >
                          <FileText style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(c.id)}
                            style={{
                              padding: '0.375rem',
                              borderRadius: 'var(--radius-md)',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-gray-400)',
                              cursor: 'pointer',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                          >
                            <Trash2 style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={isAdmin ? 10 : 9} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
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