import { useState, useEffect } from 'react';
import { Plus, PackagePlus, Loader2, Search } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { InventoryEntry, Product, Supplier, Profile } from '../../lib/types';

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
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('inventory_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (entriesError) throw entriesError;

      const { data: productsData } = await supabase.from('products').select('*').eq('status', 'active');
      const { data: suppliersData } = await supabase.from('suppliers').select('*').eq('active', true);
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name');

      const productMap = Object.fromEntries((productsData ?? []).map(p => [p.id, p]));
      const supplierMap = Object.fromEntries((suppliersData ?? []).map(s => [s.id, s]));
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));

      const enriched = (entriesData ?? []).map(entry => ({
        ...entry,
        products: productMap[entry.product_id] || null,
        suppliers: entry.supplier_id ? supplierMap[entry.supplier_id] || null : null,
        profiles: entry.created_by ? profileMap[entry.created_by] || null : null,
      }));

      setEntries(enriched);
      setProducts(productsData ?? []);
      setSuppliers(suppliersData ?? []);
    } catch (error) {
      console.error('Error fetching inventory entries:', error);
    }
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
    (e.products as Product | null)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Entradas de inventario</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{entries.length} registros</p>
        </div>
        <button
          onClick={() => { reset({ purchase_price: 0, quantity: 1 }); setModalOpen(true); }}
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
          <Plus style={{ width: '1rem', height: '1rem' }} /> Nueva entrada
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <PackagePlus style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin entradas registradas
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{(e.products as Product | null)?.name ?? '—'}</td>
                    <td style={{ fontWeight: 600, color: '#0b3b4c' }}>+{e.quantity} {(e.products as Product | null)?.unit}</td>
                    <td>{e.purchase_price ? fmt(e.purchase_price) : '—'}</td>
                    <td style={{ color: '#64748b' }}>{(e.suppliers as Supplier | null)?.name ?? '—'}</td>
                    <td style={{ maxWidth: '12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>{e.notes ?? '—'}</td>
                    <td style={{ color: '#64748b' }}>{(e.profiles as Profile | null)?.full_name ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva entrada de inventario" size="lg">
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Cantidad *</label>
              <input {...register('quantity')} type="number" step="0.01" min="0.01" className="input" />
              {errors.quantity && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.quantity.message}</p>}
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
            <textarea {...register('notes')} className="input" style={{ resize: 'vertical', minHeight: '4rem' }} placeholder="Observaciones opcionales..." />
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
              disabled={saving}
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
              Registrar entrada
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}