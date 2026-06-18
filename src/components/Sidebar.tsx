import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, PackagePlus, Sliders,
  ShoppingCart, Receipt, BarChart3, ClipboardList, Users,
  ArrowLeftRight, X, Zap, Calculator,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Categorías', to: '/categorias', icon: Tag, adminOnly: true },
      { label: 'Proveedores', to: '/proveedores', icon: Truck, adminOnly: true },
      { label: 'Productos', to: '/productos', icon: Package },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { label: 'Entradas', to: '/entradas', icon: PackagePlus, adminOnly: true },
      { label: 'Ajustes', to: '/ajustes', icon: Sliders, adminOnly: true },
      { label: 'Movimientos', to: '/movimientos', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Nueva Venta', to: '/nueva-venta', icon: ShoppingCart },
      { label: 'Historial', to: '/ventas', icon: Receipt },
      { label: 'Corte de Caja', to: '/corte-de-caja', icon: Calculator, adminOnly: true },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Reportes', to: '/reportes', icon: BarChart3, adminOnly: true },
      { label: 'Auditoría', to: '/auditoria', icon: ClipboardList, adminOnly: true },
      { label: 'Usuarios', to: '/usuarios', icon: Users, adminOnly: true },
    ],
  },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const navigate = useNavigate();

  // Estilos inline para el sidebar
  const sidebarStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    height: '100%',
    width: '16rem',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#ffffff',
    borderRight: '1px solid #edf2f7',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease',
  };

  // Estilos para el overlay en móvil
  const overlayStyle = {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 20,
    display: open ? 'block' : 'none',
  };

  return (
    <>
      {/* Overlay para móvil */}
      {open && <div style={overlayStyle} onClick={onClose} />}

      <aside style={sidebarStyle}>
        {/* Header del sidebar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #edf2f7',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b3b4c',
            }}>
              <Zap style={{ width: '1rem', height: '1rem', color: '#ffffff' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700,
                fontSize: '1rem',
                letterSpacing: '0.02em',
                color: '#1e293b',
              }}>sonder</span>
              <p style={{
                color: '#94a3b8',
                fontSize: '0.625rem',
                lineHeight: 1,
                marginTop: '0.125rem',
              }}>Todo tu negocio en movimiento</p>
            </div>
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'block',
              color: '#94a3b8',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        {/* Navegación */}
        <nav style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 0.75rem',
        }}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.adminOnly || isAdmin
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title} style={{ marginBottom: '1.25rem' }}>
                <p style={{
                  padding: '0 0.75rem',
                  marginBottom: '0.375rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#94a3b8',
                }}>
                  {group.title}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {visibleItems.map((item) => (
                    <li key={item.to} style={{ marginBottom: '0.125rem' }}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: isActive ? '#ffffff' : '#475569',
                          background: isActive ? '#0b3b4c' : 'transparent',
                          textDecoration: 'none',
                          transition: 'background 0.15s, color 0.15s',
                        })}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.classList.contains('active')) {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.color = '#1e293b';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!e.currentTarget.classList.contains('active')) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#475569';
                          }
                        }}
                      >
                        <item.icon style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer del sidebar (perfil de usuario) */}
        <div style={{
          padding: '0.75rem 0.75rem',
          borderTop: '1px solid #edf2f7',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            background: '#f8fafc',
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b3b4c',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              flexShrink: 0,
            }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#1e293b',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {profile?.full_name || 'Usuario'}
              </p>
              <p style={{
                fontSize: '0.625rem',
                color: '#94a3b8',
                margin: 0,
                textTransform: 'capitalize',
              }}>
                {profile?.role === 'admin' ? 'Administrador' : 'Empleado'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}