import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Truck, Loader2, Mail, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { Supplier } from '../../lib/types';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  contact_name: z.string().optional(),
  email: z.string().email('Email invalido').or(z.literal('')).optional(),
  phone: z.string().regex(/^[0-9+\-\s()]*$/, 'Solo numeros y signos de telefono').optional(),
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

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', contact_name: '', email: '', phone: '', address: '', active: true });
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    reset({
      name: s.name,
      contact_name: s.contact_name ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      active: s.active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    const payload = {
      name: data.name,
      contact_name: data.contact_name || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      active: data.active,
    };
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

  const filtered = suppliers.filter((s) =>
    [s.name, s.contact_name, s.email, s.phone].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  // Estilos reutilizables (inline)
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
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
          <h1 style={titleStyle}>Proveedores</h1>
          <p style={subtitleStyle}>{suppliers.length} proveedores registrados</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={buttonPrimaryStyle}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo proveedor
          </button>
        )}
      </div>

      <div style={searchWrapperStyle}>
        <Search style={searchIconStyle} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor..."
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

      {loading ? (
        <div style={loadingStyle}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Truck style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin proveedores
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ color: '#64748b' }}>{s.contact_name ?? '—'}</td>
                    <td>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#0b3b4c', textDecoration: 'none' }}>
                          <Mail style={{ width: '0.75rem', height: '0.75rem' }} /> {s.email}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {s.phone ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <Phone style={{ width: '0.75rem', height: '0.75rem', color: '#94a3b8' }} /> {s.phone}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${s.active ? 'badge-success' : 'badge-neutral'}`}>
                        {s.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <button
                            onClick={() => openEdit(s)}
                            style={{
                              padding: '0.375rem',
                              borderRadius: '0.5rem',
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                          >
                            <Pencil style={{ width: '1rem', height: '1rem' }} />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            style={{
                              padding: '0.375rem',
                              borderRadius: '0.5rem',
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                          >
                            <Trash2 style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Nombre de la empresa *</label>
              <input
                {...register('name')}
                className="input"
                placeholder="Distribuidora XYZ"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0b3b4c';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 59, 76, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errors.name && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Nombre del contacto</label>
              <input
                {...register('contact_name')}
                className="input"
                placeholder="Juan García"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
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
            <div>
              <label className="label">Teléfono</label>
              <input
                {...register('phone')}
                className="input"
                placeholder="+52 55 1234 5678"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0b3b4c';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 59, 76, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errors.phone && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="contacto@empresa.com"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0b3b4c';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 59, 76, 0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errors.email && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.email.message}</p>}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Dirección</label>
              <input
                {...register('address')}
                className="input"
                placeholder="Calle, Ciudad, CP"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="sup-active"
              {...register('active')}
              style={{ width: '1rem', height: '1rem', accentColor: '#0b3b4c' }}
            />
            <label htmlFor="sup-active" style={{ fontSize: '0.875rem', color: '#64748b' }}>Proveedor activo</label>
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
              {editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}