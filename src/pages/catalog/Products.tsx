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
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { logAudit } from '../../lib/audit';
import type { Product, Category, Supplier } from '../../lib/types';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  barcode: z.string().regex(/^[0-9]*$/, 'Solo números').optional().or(z.literal('')),
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

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', barcode: '', category_id: '', supplier_id: '', purchase_price: 0, sale_price: 0, stock: 0, min_stock: 0, unit: 'pieza', status: 'active' });
    setModalOpen(true);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    reset({
      name: p.name,
      barcode: p.barcode ?? '',
      category_id: p.category_id ?? '',
      supplier_id: p.supplier_id ?? '',
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      stock: p.stock,
      min_stock: p.min_stock,
      unit: p.unit,
      status: p.status,
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
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    if (profile) await logAudit(profile.id, 'DELETE', 'products', p.id, p, null);
    fetchAll();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  return (
    // Contenedor principal: altura fija al 100% del padre
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      {/* Header y filtros (contenido flexible que no crece) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Productos</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{filtered.length} productos</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#0b3b4c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo producto
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o código..." className="input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="input" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="input" style={{ width: 'auto', minWidth: '140px' }}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low">Stock bajo</option>
        </select>
      </div>

      {/* Contenedor de la TABLA únicamente: crece y se encoge, pero NO contiene la paginación */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto', // ← se ajusta a la altura real de sus 16 filas (reales+vacías), nunca más ni menos
          maxHeight: '100%', // ← red de seguridad: si algún día hay más contenido del esperado, topa aquí y scrollea
          minHeight: 0,
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
          </div>
        ) : (
          <div
            style={{
              flex: '1 1 0%', // ← ocupa todo el alto del card, único responsable del scroll
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Producto</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Categoría</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Código barras</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>P. Compra</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>P. Venta</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Stock</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Unidad</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Estado</th>
                  {isAdmin && <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Package style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin productos
                  </td></tr>
                ) : (
                  paginatedItems.map((p) => {
                    const isLow = p.stock <= p.min_stock && p.status === 'active';
                    return (
                      <tr key={p.id} style={isLow ? { backgroundColor: '#fef3c7' } : {}}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isLow && <AlertTriangle style={{ width: '0.875rem', height: '0.875rem', color: '#d97706', flexShrink: 0 }} />}
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
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.25rem' }}>(min. {p.min_stock})</span>
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
                              <button onClick={() => openEdit(p)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                                <Pencil style={{ width: '1rem', height: '1rem' }} />
                              </button>
                              <button onClick={() => handleDelete(p)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                                <Trash2 style={{ width: '1rem', height: '1rem' }} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
                {/* Filas fantasma: rellenan el espacio hasta PAGE_SIZE para que la tabla
                    siempre mida lo mismo, sin importar cuántos productos reales haya en esta página */}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={isAdmin ? 9 : 8} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación: bloque SEPARADO de la tabla, siempre visible al fondo del layout */}
      <div style={{ flexShrink: 0 }}>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      </div>

      {/* Modal (sin cambios) */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Nuevo producto'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Nombre del producto *</label>
              <input {...register('name')} className="input" placeholder="Ej: Laptop Dell XPS 15" />
              {errors.name && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Código de barras</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <ScanBarcode style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
                  <input {...register('barcode')} ref={(e) => { register('barcode').ref(e); (barcodeRef as React.MutableRefObject<HTMLInputElement | null>).current = e; }} className="input" style={{ paddingLeft: '2.25rem' }} placeholder="Solo números" />
                </div>
                <button type="button" onClick={() => setScannerOpen(true)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer' }}><Camera style={{ width: '1rem', height: '1rem' }} /></button>
              </div>
              {errors.barcode && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.barcode.message}</p>}
              {scannerOpen && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />}
            </div>
            <div>
              <label className="label">Unidad de medida *</label>
              <select {...register('unit')} className="input">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {errors.unit && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.unit.message}</p>}
            </div>
            <div>
              <label className="label">Categoría</label>
              <select {...register('category_id')} className="input">
                <option value="">Sin categoría</option>
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
              {errors.purchase_price && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.purchase_price.message}</p>}
            </div>
            <div>
              <label className="label">Precio de venta *</label>
              <input {...register('sale_price')} type="number" step="0.01" min="0" className="input" />
              {errors.sale_price && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.sale_price.message}</p>}
            </div>
            <div>
              <label className="label">Stock actual *</label>
              <input {...register('stock')} type="number" step="0.01" min="0" className="input" />
              {errors.stock && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.stock.message}</p>}
            </div>
            <div>
              <label className="label">Stock mínimo *</label>
              <input {...register('min_stock')} type="number" step="0.01" min="0" className="input" />
              {errors.min_stock && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.min_stock.message}</p>}
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
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', background: '#0b3b4c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>{saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}{editing ? 'Guardar' : 'Crear producto'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
