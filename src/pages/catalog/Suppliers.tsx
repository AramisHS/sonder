import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Truck, Loader2, Mail, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { logAudit } from '../../lib/audit';
import type { Supplier } from '../../lib/types';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  contact_name: z.string().optional(),
  email: z.string().email('Email inválido').or(z.literal('')).optional(),
  phone: z.string().regex(/^[0-9+\-\s()]*$/, 'Solo números y signos de teléfono').optional(),
  address: z.string().optional(),
  active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function Suppliers() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { active: true },
  });

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = suppliers.filter((s) =>
    [s.name, s.contact_name, s.email, s.phone].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', contact_name: '', email: '', phone: '', address: '', active: true });
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    reset({ name: s.name, contact_name: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', active: s.active });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    const payload = { name: data.name, contact_name: data.contact_name || null, email: data.email || null, phone: data.phone || null, address: data.address || null, active: data.active };
    if (editing) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id);
      await logAudit(profile.id, 'UPDATE', 'suppliers', editing.id, editing, payload);
    } else {
      const { data: created } = await supabase.from('suppliers').insert(payload).select().single();
      if (created) await logAudit(profile.id, 'INSERT', 'suppliers', created.id, null, payload);
    }
    setSaving(false);
    setModalOpen(false);
    fetch();
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Eliminar proveedor "${s.name}"?`)) return;
    await supabase.from('suppliers').delete().eq('id', s.id);
    if (profile) await logAudit(profile.id, 'DELETE', 'suppliers', s.id, s, null);
    fetch();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Proveedores</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{filtered.length} proveedores</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#0b3b4c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo proveedor
          </button>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor..." className="input" style={{ paddingLeft: '2.25rem' }} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto',
          maxHeight: '100%',
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
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Nombre</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Contacto</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Email</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Teléfono</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>Estado</th>
                  {isAdmin && <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Truck style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin proveedores
                  </td></tr>
                ) : (
                  paginatedItems.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ color: '#64748b' }}>{s.contact_name ?? '—'}</td>
                      <td>{s.email ? <a href={`mailto:${s.email}`} style={{ color: '#0b3b4c', textDecoration: 'none', fontSize: '0.875rem' }}>{s.email}</a> : '—'}</td>
                      <td style={{ color: '#64748b' }}>{s.phone ?? '—'}</td>
                      <td>
                        <span className={`badge ${s.active ? 'badge-success' : 'badge-neutral'}`}>
                          {s.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button onClick={() => openEdit(s)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                              <Pencil style={{ width: '1rem', height: '1rem' }} />
                            </button>
                            <button onClick={() => handleDelete(s)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                              <Trash2 style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
                {paginatedItems.length > 0 &&
                  Array.from({ length: Math.max(0, PAGE_SIZE - paginatedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true" style={{ height: '56px' }}>
                      <td colSpan={isAdmin ? 6 : 5} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Nombre de la empresa *</label>
              <input {...register('name')} className="input" placeholder="Distribuidora XYZ" />
              {errors.name && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Nombre del contacto</label>
              <input {...register('contact_name')} className="input" placeholder="Juan García" />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input {...register('phone')} className="input" placeholder="+52 55 1234 5678" />
              {errors.phone && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="contacto@empresa.com" />
              {errors.email && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Dirección</label>
              <input {...register('address')} className="input" placeholder="Calle, Ciudad, CP" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="sup-active" {...register('active')} style={{ width: '1rem', height: '1rem', accentColor: '#0b3b4c' }} />
            <label htmlFor="sup-active" style={{ fontSize: '0.875rem', color: '#64748b' }}>Proveedor activo</label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', background: '#f1f5f9', color: '#334155', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', background: '#0b3b4c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>{saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}{editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}