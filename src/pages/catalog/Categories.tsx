import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Tag, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
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
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const PAGE_SIZE = 16;
  const { paginatedItems, currentPage, totalPages, goToPage } = usePagination(filtered, PAGE_SIZE);

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
      await supabase.from('categories').update({ name: data.name, description: data.description || null, active: data.active }).eq('id', editing.id);
      await logAudit(profile.id, 'UPDATE', 'categories', editing.id, editing, data);
    } else {
      const { data: created } = await supabase.from('categories').insert({ name: data.name, description: data.description || null, active: data.active }).select().single();
      if (created) await logAudit(profile.id, 'INSERT', 'categories', created.id, null, data);
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

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      gap: '1rem',
      transition: 'background 0.25s ease',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '1rem', 
        flexWrap: 'wrap', 
        flexShrink: 0 
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>
            Categorías
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
            {filtered.length} categorías
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={openCreate} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.5rem', 
              background: 'var(--color-primary)', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 500, 
              fontSize: '0.875rem',
              transition: 'background 0.15s',
            }}
          >
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nueva categoría
          </button>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search style={{ 
          position: 'absolute', 
          left: '0.75rem', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          width: '1rem', 
          height: '1rem', 
          color: 'var(--color-gray-400)' 
        }} />
        <input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Buscar categoría..." 
          className="input" 
          style={{ paddingLeft: '2.25rem' }} 
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto',
          maxHeight: '100%',
          minHeight: 0,
          border: '1px solid var(--color-card-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--color-card-bg)',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
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
                  <th style={{ 
                    position: 'sticky', 
                    top: 0, 
                    background: 'var(--color-table-header)', 
                    zIndex: 1,
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Nombre
                  </th>
                  <th style={{ 
                    position: 'sticky', 
                    top: 0, 
                    background: 'var(--color-table-header)', 
                    zIndex: 1,
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Descripción
                  </th>
                  <th style={{ 
                    position: 'sticky', 
                    top: 0, 
                    background: 'var(--color-table-header)', 
                    zIndex: 1,
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Estado
                  </th>
                  <th style={{ 
                    position: 'sticky', 
                    top: 0, 
                    background: 'var(--color-table-header)', 
                    zIndex: 1,
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Creada
                  </th>
                  {isAdmin && <th style={{ 
                    position: 'sticky', 
                    top: 0, 
                    background: 'var(--color-table-header)', 
                    zIndex: 1, 
                    textAlign: 'right',
                    transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  }}>
                    Acciones
                  </th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-gray-400)' }}>
                    <Tag style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    Sin categorías
                  </td></tr>
                ) : (
                  paginatedItems.map((cat) => (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>{cat.name}</td>
                      <td style={{ color: 'var(--color-gray-500)' }}>{cat.description ?? '—'}</td>
                      <td>
                        <span className={`badge ${cat.active ? 'badge-success' : 'badge-neutral'}`}>
                          {cat.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-gray-500)' }}>
                        {new Date(cat.created_at).toLocaleDateString('es-MX')}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button 
                              onClick={() => openEdit(cat)} 
                              style={{ 
                                padding: '0.375rem', 
                                borderRadius: '0.5rem', 
                                border: 'none', 
                                background: 'transparent', 
                                color: 'var(--color-gray-400)', 
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                            >
                              <Pencil style={{ width: '1rem', height: '1rem' }} />
                            </button>
                            <button 
                              onClick={() => handleDelete(cat)} 
                              style={{ 
                                padding: '0.375rem', 
                                borderRadius: '0.5rem', 
                                border: 'none', 
                                background: 'transparent', 
                                color: 'var(--color-gray-400)', 
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                            >
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
                      <td colSpan={isAdmin ? 5 : 4} style={{ height: '56px', padding: 0 }}>&nbsp;</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Nombre *</label>
            <input {...register('name')} className="input" placeholder="Electrónicos" />
            {errors.name && <p style={{ fontSize: '0.75rem', color: 'var(--color-error-text)', marginTop: '0.25rem' }}>{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea {...register('description')} className="input" style={{ resize: 'vertical', minHeight: '5rem' }} placeholder="Descripción opcional..." />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="active" 
              {...register('active')} 
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--color-primary)' }} 
            />
            <label htmlFor="active" style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
              Categoría activa
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setModalOpen(false)} 
              style={{ 
                flex: 1, 
                padding: '0.5rem 0', 
                borderRadius: '0.5rem', 
                background: 'var(--color-gray-100)', 
                color: 'var(--color-gray-700)', 
                border: 'none', 
                cursor: 'pointer', 
                fontWeight: 500, 
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-gray-200)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-gray-100)'}
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
                background: 'var(--color-primary)', 
                color: '#fff', 
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