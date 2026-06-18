import { useState, useEffect } from 'react';
import { Calculator, Loader2, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { logAudit } from '../../lib/audit';
import { exportCashClosingPDF } from '../../lib/pdf';

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
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [alreadyClosed, setAlreadyClosed] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const fetchClosings = async () => {
    setLoading(true);
    try {
      const { data: closingsData, error } = await supabase
        .from('cash_register_closings')
        .select('*')
        .order('closing_date', { ascending: false })
        .limit(30);
      if (error) throw error;

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

  const checkAlreadyClosed = async () => {
    const { data } = await supabase
      .from('cash_register_closings')
      .select('id')
      .eq('closing_date', closingDate)
      .maybeSingle();
    setAlreadyClosed(!!data);
  };

  useEffect(() => { fetchClosings(); }, []);
  useEffect(() => { checkAlreadyClosed(); }, [closingDate]);

  const handleClosing = async () => {
    if (!profile) return;
    setSaving(true);

    const start = new Date(closingDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(closingDate);
    end.setHours(23, 59, 59, 999);

    const { data: sales } = await supabase
      .from('sales')
      .select('total, payment_method')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const cashTotal = (sales ?? []).filter(s => s.payment_method === 'efectivo').reduce((a, s) => a + s.total, 0);
    const transferTotal = (sales ?? []).filter(s => s.payment_method === 'transferencia').reduce((a, s) => a + s.total, 0);
    const cardTotal = (sales ?? []).filter(s => s.payment_method === 'tarjeta').reduce((a, s) => a + s.total, 0);
    const totalSales = (sales ?? []).reduce((a, s) => a + s.total, 0);
    const salesCount = sales?.length ?? 0;

    const { data: created } = await supabase
      .from('cash_register_closings')
      .insert({
        closing_date: closingDate,
        total_sales: totalSales,
        cash_total: cashTotal,
        transfer_total: transferTotal,
        card_total: cardTotal,
        sales_count: salesCount,
        notes: notes || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (created) {
      await logAudit(profile.id, 'INSERT', 'cash_register_closings', created.id, null, created);
    }

    setSaving(false);
    setNotes('');
    fetchClosings();
    checkAlreadyClosed();
  };

  const handlePDF = (row: ClosingRow) => {
    exportCashClosingPDF(row);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Corte de Caja</h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{closings.length} cortes registrados</p>
      </div>

      <div style={{ padding: '1.25rem', border: '1px solid #edf2f7', borderRadius: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Calculator style={{ width: '1.25rem', height: '1.25rem', color: '#0b3b4c' }} />
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>Realizar corte</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label className="label">Fecha del corte</label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
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
            {alreadyClosed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#fef3c7', color: '#92400e', fontSize: '0.875rem' }}>
                <AlertCircle style={{ width: '1rem', height: '1rem' }} />
                Ya existe un corte para esta fecha
              </div>
            ) : (
              <button
                onClick={handleClosing}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#0b3b4c',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0a2f3d'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0b3b4c'}
              >
                {saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}
                Realizar corte
              </button>
            )}
          </div>
        </div>
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
                <th>Fecha</th>
                <th>Total ventas</th>
                <th>Efectivo</th>
                <th>Transferencia</th>
                <th>Tarjeta</th>
                <th>No. Ventas</th>
                <th>Responsable</th>
                <th style={{ textAlign: 'right' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Calculator style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin cortes de caja registrados
                  </td>
                </tr>
              ) : (
                closings.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(c.closing_date + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>{fmt(c.total_sales)}</td>
                    <td>{fmt(c.cash_total)}</td>
                    <td>{fmt(c.transfer_total)}</td>
                    <td>{fmt(c.card_total)}</td>
                    <td>{c.sales_count}</td>
                    <td style={{ color: '#64748b' }}>{(c.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handlePDF(c)}
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
                        title="Descargar PDF"
                      >
                        <FileText style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}