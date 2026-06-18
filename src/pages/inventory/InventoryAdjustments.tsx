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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ajustes de inventario</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Correcciones manuales de stock</p>
        </div>
        <button onClick={() => { reset({ new_quantity: 0 }); setModalOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo ajuste
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por producto..." className="input pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} /></div>
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
                  <td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Sliders className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin ajustes registrados
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const diff = a.quantity_after - a.quantity_before;
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="font-medium">{(a.products as { name: string } | null)?.name ?? '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.quantity_before} {(a.products as { unit: string } | null)?.unit}</td>
                      <td className="font-semibold">{a.quantity_after} {(a.products as { unit: string } | null)?.unit}</td>
                      <td>
                        <span className={`font-semibold`} style={{ color: diff > 0 ? 'var(--color-success-600)' : diff < 0 ? 'var(--color-error-600)' : 'var(--text-secondary)' }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      </td>
                      <td className="max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{a.reason ?? '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{(a.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo ajuste de inventario" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Producto *</label>
            <select {...register('product_id')} className="input">
              <option value="">Seleccionar producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock} {p.unit})</option>
              ))}
            </select>
            {errors.product_id && <p className="mt-1 text-xs" style={{ color: 'var(--color-error-500)' }}>{errors.product_id.message}</p>}
          </div>

          {selectedProduct && (
            <div className="callout-info px-3 py-2 rounded-lg border">
              <p className="text-xs font-medium">
                Stock actual: <span className="font-bold">{selectedProduct.stock} {selectedProduct.unit}</span>
              </p>
            </div>
          )}

          <div>
            <label className="label">Nueva cantidad *</label>
            <input {...register('new_quantity')} type="number" step="0.01" min="0" className="input" />
            {errors.new_quantity && <p className="mt-1 text-xs" style={{ color: 'var(--color-error-500)' }}>{errors.new_quantity.message}</p>}
          </div>

          <div>
            <label className="label">Motivo del ajuste *</label>
            <textarea {...register('reason')} className="input resize-none h-20" placeholder="Ej: Conteo físico, merma, robo, etc." />
            {errors.reason && <p className="mt-1 text-xs" style={{ color: 'var(--color-error-500)' }}>{errors.reason.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar ajuste
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
