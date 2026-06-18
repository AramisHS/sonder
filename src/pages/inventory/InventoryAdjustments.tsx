import { useState, useEffect } from 'react';
import { Plus, Sliders, Loader2, Search } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { InventoryAdjustment, Product } from '../../lib/types';

const schema = z.object({
  product_id: z.string().min(1, 'Selecciona un producto'),
  new_quantity: z.coerce.number().min(0, 'No puede ser negativo'),
  reason: z.string().min(1, 'Describe el motivo'),
});
type FormData = z.infer<typeof schema>;

export default function InventoryAdjustments() {
  const { profile } = useAuthStore();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { new_quantity: 0 },
  });

  const watchProduct = watch('product_id');

  useEffect(() => {
    const p = products.find((pr) => pr.id === watchProduct);
    setSelectedProduct(p ?? null);
    if (p) {
      reset((prev) => ({ ...prev, new_quantity: p.stock }));
    }
  }, [watchProduct, products]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase
        .from('inventory_adjustments')
        .select('*, products(name,unit), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
    ]);
    setAdjustments(a ?? []);
    setProducts(p ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.rpc('process_inventory_adjustment', {
      p_product_id: data.product_id,
      p_new_quantity: data.new_quantity,
      p_reason: data.reason,
      p_user_id: profile.id,
    });
    if (!error) {
      await logAudit(profile.id, 'INVENTORY_ADJUSTMENT', 'inventory_adjustments', undefined, null, data);
      setModalOpen(false);
      reset({ new_quantity: 0 });
      fetchAll();
    } else {
      alert('Error al registrar ajuste: ' + error.message);
    }
    setSaving(false);
  };

  const filtered = adjustments.filter((a) =>
    (a.products as { name: string } | null)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Ajustes de inventario</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Correcciones manuales de stock</p>
        </div>
        <button
          onClick={() => { reset({ new_quantity: 0 }); setModalOpen(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: '#0b3b4c',
            color: '#ffffff',
            border: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0a2f3d'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#0b3b4c'}
        >
          <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo ajuste
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto..."
          className="input"
          style={{ paddingLeft: '2.25rem' }}
        />
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
                <th>Producto</th>
                <th>Stock anterior</th>
                <th>Stock nuevo</th>
                <th>Diferencia</th>
                <th>Motivo</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Sliders style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin ajustes registrados
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const diff = a.quantity_after - a.quantity_before;
                  return (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                        {new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{(a.products as { name: string } | null)?.name ?? '—'}</td>
                      <td style={{ color: '#64748b' }}>{a.quantity_before} {(a.products as { unit: string } | null)?.unit}</td>
                      <td style={{ fontWeight: 600 }}>{a.quantity_after} {(a.products as { unit: string } | null)?.unit}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : '#64748b' }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      </td>
                      <td style={{ maxWidth: '12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>{a.reason ?? '—'}</td>
                      <td style={{ color: '#64748b' }}>{(a.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo ajuste de inventario" size="md">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Producto *</label>
            <select {...register('product_id')} className="input">
              <option value="">Seleccionar producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock} {p.unit})</option>
              ))}
            </select>
            {errors.product_id && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.product_id.message}</p>}
          </div>

          {selectedProduct && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.875rem' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                Stock actual: <span style={{ fontWeight: 700 }}>{selectedProduct.stock} {selectedProduct.unit}</span>
              </p>
            </div>
          )}

          <div>
            <label className="label">Nueva cantidad *</label>
            <input {...register('new_quantity')} type="number" step="0.01" min="0" className="input" />
            {errors.new_quantity && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.new_quantity.message}</p>}
          </div>

          <div>
            <label className="label">Motivo del ajuste *</label>
            <textarea {...register('reason')} className="input" style={{ resize: 'vertical', minHeight: '4rem' }} placeholder="Ej: Conteo físico, merma, robo, etc." />
            {errors.reason && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.reason.message}</p>}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: '0.5rem',
                background: '#f1f5f9',
                color: '#334155',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: '0.5rem',
                background: '#0b3b4c',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0a2f3d'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0b3b4c'}
            >
              {saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}
              Registrar ajuste
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}