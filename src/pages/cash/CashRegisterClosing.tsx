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
    const { data } = await supabase
      .from('cash_register_closings')
      .select('*, profiles(full_name)')
      .order('closing_date', { ascending: false })
      .limit(30);
    setClosings(data ?? []);
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
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Corte de Caja</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cierra la caja diaria y consulta cortes anteriores</p>
      </div>

      {/* New closing form */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5" style={{ color: 'var(--color-brand-600)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Realizar corte</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Fecha del corte</label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="label">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del día..."
              className="input"
            />
          </div>
          <div className="flex items-end">
            {alreadyClosed ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--color-warning-50)', color: 'var(--color-warning-700)' }}>
                <AlertCircle className="w-4 h-4" />
                Ya existe un corte para esta fecha
              </div>
            ) : (
              <button
                onClick={handleClosing}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Realizar corte
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} />
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
                <th className="text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin cortes de caja registrados
                  </td>
                </tr>
              ) : (
                closings.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{new Date(c.closing_date + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td className="font-semibold" style={{ color: 'var(--color-success-600)' }}>{fmt(c.total_sales)}</td>
                    <td>{fmt(c.cash_total)}</td>
                    <td>{fmt(c.transfer_total)}</td>
                    <td>{fmt(c.card_total)}</td>
                    <td>{c.sales_count}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(c.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    <td className="text-right">
                      <button
                        onClick={() => handlePDF(c)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        title="Descargar PDF"
                      >
                        <FileText className="w-4 h-4" />
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
