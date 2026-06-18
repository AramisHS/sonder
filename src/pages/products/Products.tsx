import { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Search, Package, Loader2, AlertTriangle,
  ScanBarcode, Camera,
} from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import BarcodeScanner from '../../components/BarcodeScanner';
import { logAudit } from '../../lib/audit';
import type { Product, Category, Supplier } from '../../lib/types';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  barcode: z.string().regex(/^[0-9]*$/, 'Solo numeros en codigo de barras').optional().or(z.literal('')),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
  purchase_price: z.coerce.number().min(0),
  sale_price: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  min_stock: z.coerce.number().min(0),
  unit: z.string().min(1, 'Requerido'),
  status: z.enum(['active', 'inactive']),
});
type FormData = z.infer<typeof schema>;

const UNITS = ['pieza', 'kg', 'litro', 'caja', 'par', 'rollo', 'metro', 'docena', 'paquete', 'otro'];

export default function Products() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'low'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { unit: 'pieza', status: 'active', purchase_price: 0, sale_price: 0, stock: 0, min_stock: 0, barcode: '' },
  });

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from('products').select('*, categories(id,name), suppliers(id,name)').order('name'),
      supabase.from('categories').select('*').eq('active', true).order('name'),
      supabase.from('suppliers').select('*').eq('active', true).order('name'),
    ]);
    setProducts(p ?? []);
    setCategories(c ?? []);
    setSuppliers(s ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', barcode: '', category_id: '', supplier_id: '', purchase_price: 0, sale_price: 0, stock: 0, min_stock: 0, unit: 'pieza', status: 'active' });
    setModalOpen(true);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    reset({
      name: p.name, barcode: p.barcode ?? '', category_id: p.category_id ?? '',
      supplier_id: p.supplier_id ?? '', purchase_price: p.purchase_price,
      sale_price: p.sale_price, stock: p.stock, min_stock: p.min_stock,
      unit: p.unit, status: p.status,
    });
    setModalOpen(true);
  };

  const handleBarcodeScan = (code: string) => {
    setValue('barcode', code);
    setScannerOpen(false);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    const payload = {
      name: data.name,
      barcode: data.barcode || null,
      category_id: data.category_id || null,
      supplier_id: data.supplier_id || null,
      purchase_price: data.purchase_price,
      sale_price: data.sale_price,
      stock: data.stock,
      min_stock: data.min_stock,
      unit: data.unit,
      status: data.status,
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
      await logAudit(profile.id, 'UPDATE', 'products', editing.id, editing, payload);
    } else {
      const { data: created } = await supabase.from('products').insert(payload).select().single();
      if (created) await logAudit(profile.id, 'INSERT', 'products', created.id, null, payload);
    }
    setSaving(false);
    setModalOpen(false);
    fetchAll();
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Eliminar "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    if (profile) await logAudit(profile.id, 'DELETE', 'products', p.id, p, null);
    fetchAll();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const filtered = products.filter((p) => {
    const matchSearch = [p.name, p.barcode].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    const matchCat = !filterCat || p.category_id === filterCat;
    const matchStatus =
      filterStatus === 'all' ? true :
        filterStatus === 'low' ? p.stock <= p.min_stock && p.status === 'active' :
          p.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  // Estilos inline reutilizables
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
    width: '100%',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  };

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#1e293b',
  };

  const subtitleStyle = {
    fontSize: '0.875rem',
    color: '#64748b',
  };

  const searchWrapperStyle = {
    position: 'relative' as const,
    flex: 1,
  };

  const searchIconStyle = {
    position: 'absolute' as const,
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '1rem',
    height: '1rem',
    color: '#94a3b8',
  };

  const searchInputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
    borderRadius: '0.5rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const filterSelectStyle = {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    fontSize: '0.875rem',
    outline: 'none',
    minWidth: '10rem',
  };

  const buttonPrimaryStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    background: '#0b3b4c',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  const loadingStyle = {
    display: 'flex',
    justifyContent: 'center',
    padding: '3rem 0',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Productos</h1>
          <p style={subtitleStyle}>{products.length} productos registrados</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={buttonPrimaryStyle}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo producto
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
        <div style={searchWrapperStyle}>
          <Search style={searchIconStyle} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o codigo de barras..."
            style={searchInputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0b3b4c';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 59, 76, 0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="">Todas las categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          style={filterSelectStyle}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low">Stock bajo</option>
        </select>
      </div>

      {loading ? (
        <div style={loadingStyle}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Codigo barras</th>
                <th>P. Compra</th>
                <th>P. Venta</th>
                <th>Stock</th>
                <th>Unidad</th>
                <th>Estado</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Package style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin productos
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock <= p.min_stock && p.status === 'active';
                  return (
                    <tr key={p.id} style={isLow ? { background: '#fffbeb' } : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isLow && <AlertTriangle style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0, color: '#d97706' }} />}
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#64748b' }}>{(p as { categories?: { name: string } }).categories?.name ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{p.barcode ?? '—'}</td>
                      <td>{fmt(p.purchase_price)}</td>
                      <td style={{ fontWeight: 600, color: '#059669' }}>{fmt(p.sale_price)}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: p.stock === 0 ? '#dc2626' : isLow ? '#d97706' : '#1e293b' }}>
                          {p.stock}
                        </span>
                        {isLow && p.min_stock > 0 && (
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem', color: '#94a3b8' }}>(min. {p.min_stock})</span>
                        )}
                      </td>
                      <td style={{ color: '#64748b' }}>{p.unit}</td>
                      <td>
                        <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                          {p.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button
                              onClick={() => openEdit(p)}
                              style={{ padding: '0.375rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', transition: 'color 0.15s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                              <Pencil style={{ width: '1rem', height: '1rem' }} />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              style={{ padding: '0.375rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', transition: 'color 0.15s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                              <Trash2 style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Nuevo producto'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Nombre del producto *</label>
              <input
                {...register('name')}
                className="input"
                placeholder="Ej: Laptop Dell XPS 15"
              />
              {errors.name && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Codigo de barras</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <ScanBarcode style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
                  <input
                    {...register('barcode')}
                    ref={(e) => { register('barcode').ref(e); (barcodeRef as React.MutableRefObject<HTMLInputElement | null>).current = e; }}
                    className="input"
                    placeholder="Solo numeros"
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer' }}
                >
                  <Camera style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
              {errors.barcode && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.barcode.message}</p>}
              {scannerOpen && (
                <div style={{ marginTop: '0.5rem' }}>
                  <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />
                </div>
              )}
            </div>
            <div>
              <label className="label">Unidad de medida *</label>
              <select {...register('unit')} className="input">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {errors.unit && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.unit.message}</p>}
            </div>
            <div>
              <label className="label">Categoria</label>
              <select {...register('category_id')} className="input">
                <option value="">Sin categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor</label>
              <select {...register('supplier_id')} className="input">
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Precio de compra *</label>
              <input {...register('purchase_price')} type="number" step="0.01" min="0" className="input" />
              {errors.purchase_price && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.purchase_price.message}</p>}
            </div>
            <div>
              <label className="label">Precio de venta *</label>
              <input {...register('sale_price')} type="number" step="0.01" min="0" className="input" />
              {errors.sale_price && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.sale_price.message}</p>}
            </div>
            <div>
              <label className="label">Stock actual *</label>
              <input {...register('stock')} type="number" step="0.01" min="0" className="input" />
              {errors.stock && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.stock.message}</p>}
            </div>
            <div>
              <label className="label">Stock minimo *</label>
              <input {...register('min_stock')} type="number" step="0.01" min="0" className="input" />
              {errors.min_stock && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.min_stock.message}</p>}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Estado</label>
              <select {...register('status')} className="input">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
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
              {editing ? 'Guardar' : 'Crear producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}