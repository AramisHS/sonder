import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, Truck, PackagePlus, Sliders,
  ShoppingCart, Receipt, BarChart3, ClipboardList, Users,
  ArrowLeftRight, Calculator,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
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
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, adminOnly: true }],
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
      { label: 'Entradas', to: '/entradas', icon: PackagePlus },
      { label: 'Ajustes', to: '/ajustes', icon: Sliders},
      { label: 'Movimientos', to: '/movimientos', icon: ArrowLeftRight, adminOnly: true },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Nueva Venta', to: '/nueva-venta', icon: ShoppingCart },
      { label: 'Historial', to: '/ventas', icon: Receipt },
      { label: 'Corte de Caja', to: '/corte-de-caja', icon: Calculator },
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

const getSectionName = (path: string): string => {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.to === path) return group.title;
    }
  }
  return '';
};

export default function Sidebar({ open, onClose, isCollapsed, isMobile }: SidebarProps) {
  const { profile } = useAuthStore();
  const { dark } = useThemeStore();
  const isAdmin = profile?.role === 'admin';
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  const showFull = !isCollapsed || isHovered;
  const activeSection = getSectionName(location.pathname);
  const isDesktop = !isMobile;

  const baseStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-sidebar-bg)',
    borderRight: '1px solid var(--color-sidebar-border)',
    boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, border-color 0.3s ease',
    willChange: 'width',
  };

  const width = isDesktop
    ? (isCollapsed && !isHovered ? '64px' : '240px')
    : '240px';

  const desktopStyles: React.CSSProperties = {
    ...baseStyles,
    position: 'sticky',
    top: 0,
    height: '100vh',
    width,
  };

  const mobileStyles: React.CSSProperties = {
    ...baseStyles,
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100%',
    zIndex: 30,
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    width,
  };

  const styles = isMobile ? mobileStyles : desktopStyles;

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 20,
          }}
        />
      )}
      <aside
        style={styles}
        onMouseEnter={() => {
          if (isDesktop && isCollapsed) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (isDesktop && isCollapsed) setIsHovered(false);
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem 0.5rem',
            borderBottom: '1px solid var(--color-sidebar-border)', // ← variable
            flexShrink: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <img
            src="/images/sonder-logo.png"
            alt="sonder"
            style={{
              width: showFull ? '72px' : '36px',
              height: showFull ? '72px' : '36px',
              objectFit: 'contain',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease',
              marginBottom: showFull ? '0.4rem' : '0.2rem',
              filter: dark ? 'invert(0.9) brightness(1.2)' : 'none',
            }}
          />
          {showFull ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', margin: 0, textAlign: 'center' }}>
              Todo tu negocio en movimiento
            </p>
          ) : (
            <p
              style={{
                fontSize: '0.45rem',
                color: 'var(--color-primary)',
                margin: 0,
                textAlign: 'center',
                fontWeight: 600,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                maxWidth: '56px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeSection}
            </p>
          )}
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 0',
            overflowX: 'hidden',
          }}
        >
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title} style={{ marginBottom: '1rem' }}>
                {showFull && (
                  <p
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-sidebar-title)',
                      margin: 0,
                    }}
                  >
                    {group.title}
                  </p>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {visibleItems.map((item) => (
                    <li key={item.to} style={{ margin: '0.1rem 0' }}>
                      <NavLink
                        to={item.to}
                        className="sidebar-nav-link"
                        onClick={() => {
                          if (isMobile) onClose();
                        }}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 1rem',
                          margin: '0 0.5rem',
                          borderRadius: '0.5rem',
                          color: isActive ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
                          backgroundColor: isActive ? 'var(--color-sidebar-active-bg)' : 'transparent',
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          transition: 'background 0.15s, color 0.15s',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          position: 'relative',
                        })}
                      >
                        <item.icon style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
                        {showFull && <span>{item.label}</span>}
                        {!showFull && (
                          <span className="sidebar-tooltip">{item.label}</span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div style={{ flexShrink: 0, height: '0.75rem' }} />
      </aside>
    </>
  );
}