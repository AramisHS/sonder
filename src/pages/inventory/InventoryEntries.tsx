import { useState, useEffect } from 'react';
import { Plus, PackagePlus, Loader2, Search } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { InventoryEntry, Product, Supplier } from '../../lib/types';

const schema = z.object({
  product_id: z.string().min(1, 'Selecciona un producto'),
  quantity: z.coerce.number().min(0.01, 'Debe ser mayor a 0'),
  purchase_price: z.coerce.number().min(0),
  supplier_id: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function InventoryEntries() {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { purchase_price: 0, quantity: 1 },
  });

  const watchProduct = watch('product_id');

  useEffect(() => {
    const p = products.find((pr) => pr.id === watchProduct);
    setSelectedProduct(p ?? null);
    if (p) {
      reset((prev) => ({ ...prev, purchase_price: p.purchase_price }));
    }
  }, [watchProduct, products]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: e }, { data: p }, { data: s }] = await Promise.all([
      supabase
        .from('inventory_entries')
        .select('*, products(name,unit), suppliers(name), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('suppliers').select('*').eq('active', true).order('name'),
    ]);
    setEntries(e ?? []);
    setProducts(p ?? []);
    setSuppliers(s ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.rpc('process_inventory_entry', {
      p_product_id: data.product_id,
      p_quantity: data.quantity,
      p_purchase_price: data.purchase_price,
      p_supplier_id: data.supplier_id || null,
      p_notes: data.notes || null,
      p_user_id: profile.id,
    });
    if (!error) {
      await logAudit(profile.id, 'INVENTORY_ENTRY', 'inventory_entries', undefined, null, data);
      setModalOpen(false);
      reset({ purchase_price: 0, quantity: 1 });
      fetchAll();
    } else {
      alert('Error al registrar entrada: ' + error.message);
    }
    setSaving(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const filtered = entries.filter((e) =>
    (e.products as { name: string } | null)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Entradas de inventario</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Registro de mercancía recibida</p>
        </div>
        <button onClick={() => { reset({ purchase_price: 0, quantity: 1 }); setModalOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva entrada
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
                <th>Cantidad</th>
                <th>P. Compra</th>
                <th>Proveedor</th>
                <th>Notas</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <PackagePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Sin entradas registradas
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="font-medium">{(e.products as { name: string } | null)?.name ?? '—'}</td>
                    <td className="font-semibold" style={{ color: 'var(--color-brand-600)' }}>+{e.quantity} {(e.products as { unit: string } | null)?.unit}</td>
                    <td>{e.purchase_price ? fmt(e.purchase_price) : '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(e.suppliers as { name: string } | null)?.name ?? '—'}</td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{e.notes ?? '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(e.profiles as { full_name: string } | null)?.full_name ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva entrada de inventario" size="lg">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cantidad *</label>
              <input {...register('quantity')} type="number" step="0.01" min="0.01" className="input" />
              {errors.quantity && <p className="mt-1 text-xs" style={{ color: 'var(--color-error-500)' }}>{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="label">Precio de compra</label>
              <input {...register('purchase_price')} type="number" step="0.01" min="0" className="input" />
            </div>
          </div>

          <div>
            <label className="label">Proveedor</label>
            <select {...register('supplier_id')} className="input">
              <option value="">Sin proveedor específico</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea {...register('notes')} className="input resize-none h-16" placeholder="Observaciones opcionales..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar entrada
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
