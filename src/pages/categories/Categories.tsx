import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Tag, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import { logAudit } from '../../lib/audit';
import type { Category } from '../../lib/types';

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function Categories() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { active: true },
  });

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', description: '', active: true });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    reset({ name: cat.name, description: cat.description ?? '', active: cat.active });
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('categories')
        .update({ name: data.name, description: data.description || null, active: data.active })
        .eq('id', editing.id);
      if (!error) {
        await logAudit(profile.id, 'UPDATE', 'categories', editing.id, editing, data);
      }
    } else {
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ name: data.name, description: data.description || null, active: data.active })
        .select()
        .single();
      if (!error && created) {
        await logAudit(profile.id, 'INSERT', 'categories', created.id, null, data);
      }
    }
    setSaving(false);
    setModalOpen(false);
    fetch();
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`¿Eliminar categoría "${cat.name}"?`)) return;
    await supabase.from('categories').delete().eq('id', cat.id);
    if (profile) await logAudit(profile.id, 'DELETE', 'categories', cat.id, cat, null);
    fetch();
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
          <h1 style={titleStyle}>Categorías</h1>
          <p style={subtitleStyle}>{categories.length} categorías registradas</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={buttonPrimaryStyle}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nueva categoría
          </button>
        )}
      </div>

      <div style={searchWrapperStyle}>
        <Search style={searchIconStyle} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoría..."
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
                <th>Descripción</th>
                <th>Estado</th>
                <th>Creada</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
                    <Tag style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin categorías
                  </td>
                </tr>
              ) : (
                filtered.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 500 }}>{cat.name}</td>
                    <td style={{ color: '#64748b' }}>{cat.description ?? '—'}</td>
                    <td>
                      <span className={`badge ${cat.active ? 'badge-success' : 'badge-neutral'}`}>
                        {cat.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>{new Date(cat.created_at).toLocaleDateString('es-MX')}</td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <button
                            onClick={() => openEdit(cat)}
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
                            onClick={() => handleDelete(cat)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Nombre *</label>
            <input
              {...register('name')}
              className="input"
              placeholder="Electrónicos"
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
            <label className="label">Descripción</label>
            <textarea
              {...register('description')}
              className="input"
              placeholder="Descripción opcional..."
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
                resize: 'vertical',
                minHeight: '5rem',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="active"
              {...register('active')}
              style={{ width: '1rem', height: '1rem', accentColor: '#0b3b4c' }}
            />
            <label htmlFor="active" style={{ fontSize: '0.875rem', color: '#64748b' }}>Categoría activa</label>
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