import { useState, useEffect } from 'react';
import { Pencil, Search, Loader2, Shield, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { Profile } from '../../lib/types';

const schema = z.object({
  full_name: z.string().min(1, 'Requerido'),
  role: z.enum(['admin', 'employee']),
  active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function Users() {
  const { profile: currentProfile } = useAuthStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setProfiles(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const openEdit = (p: Profile) => {
    setEditing(p);
    reset({ full_name: p.full_name, role: p.role, active: p.active });
  };

  const onSubmit = async (data: FormData) => {
    if (!editing || !currentProfile) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ full_name: data.full_name, role: data.role, active: data.active })
      .eq('id', editing.id);
    await logAudit(currentProfile.id, 'UPDATE', 'profiles', editing.id, editing, data);
    setSaving(false);
    setEditing(null);
    fetchProfiles();
  };

  const filtered = profiles.filter((p) =>
    [p.full_name, p.role].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Usuarios</h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{profiles.length} usuarios registrados</p>
      </div>

      {/* Info Callout */}
      <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.875rem' }}>
        <p style={{ margin: 0 }}>
          <strong>Nota:</strong> Los nuevos usuarios se registran desde la pantalla de inicio de sesión. El primer usuario registrado es automáticamente administrador.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuario..."
          className="input"
          style={{ paddingLeft: '2.25rem' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: '#0b3b4c' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Miembro desde</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <User style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin usuarios
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            background: p.role === 'admin' ? '#0b3b4c' : '#64748b',
                          }}
                        >
                          {p.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p style={{ fontWeight: 500, color: '#1e293b' }}>{p.full_name || 'Sin nombre'}</p>
                          {p.id === currentProfile?.id && (
                            <span style={{ fontSize: '0.75rem', color: '#0b3b4c' }}>Tú</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {p.role === 'admin' ? (
                          <Shield style={{ width: '0.875rem', height: '0.875rem', color: '#0b3b4c' }} />
                        ) : (
                          <User style={{ width: '0.875rem', height: '0.875rem', color: '#94a3b8' }} />
                        )}
                        <span className={`badge ${p.role === 'admin' ? 'badge-brand' : 'badge-neutral'}`}>
                          {p.role === 'admin' ? 'Administrador' : 'Empleado'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.active ? 'badge-success' : 'badge-neutral'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString('es-MX')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openEdit(p)}
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
                      >
                        <Pencil style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar usuario">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Nombre completo</label>
            <input {...register('full_name')} className="input" />
            {errors.full_name && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Rol</label>
            <select {...register('role')} className="input">
              <option value="employee">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="user-active"
              {...register('active')}
              style={{ width: '1rem', height: '1rem', accentColor: '#0b3b4c' }}
            />
            <label htmlFor="user-active" style={{ fontSize: '0.875rem', color: '#64748b' }}>Usuario activo</label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setEditing(null)}
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
              disabled={saving}
            >
              {saving && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}