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
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Usuarios</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{profiles.length} usuarios registrados</p>
      </div>

      <div className="card p-4 callout-info">
        <p className="text-sm">
          <strong>Nota:</strong> Los nuevos usuarios se registran desde la pantalla de inicio de sesión. El primer usuario registrado es automáticamente administrador.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..." className="input pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} /></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Miembro desde</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${p.role === 'admin' ? '' : 'bg-gray-500'}`} style={p.role === 'admin' ? { background: 'var(--color-brand-600)' } : undefined}>
                        {p.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.full_name || 'Sin nombre'}</p>
                        {p.id === currentProfile?.id && (
                          <span style={{ color: 'var(--color-brand-600)' }}>Tú</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {p.role === 'admin' ? (
                        <Shield className="w-3.5 h-3.5" style={{ color: 'var(--color-brand-600)' }} />
                      ) : (
                        <User className="w-3.5 h-3.5 text-gray-400" />
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
                  <td style={{ color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="text-right">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar usuario">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input {...register('full_name')} className="input" />
            {errors.full_name && <p className="mt-1 text-xs" style={{ color: 'var(--color-error-500)' }}>{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Rol</label>
            <select {...register('role')} className="input">
              <option value="employee">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="user-active" {...register('active')} className="w-4 h-4 rounded" style={{ accentColor: 'var(--color-brand-600)' }} />
            <label htmlFor="user-active" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Usuario activo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-brand-600)' }} />}
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
