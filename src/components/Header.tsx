import { useState, useRef, useEffect } from 'react';
import { Menu, Moon, Sun, LogOut, User, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
  lowStockCount?: number;
}

export default function Header({ onMenuClick, lowStockCount = 0 }: HeaderProps) {
  const { dark, toggle } = useThemeStore();
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    setDropdownOpen(false);
  };

  // 🔥 1. EFECTO CRÍTICO: Añade o quita la clase del body cuando cambie el estado "dark"
  useEffect(() => {
    if (dark) {
      document.body.classList.add('dark-mode');
      // O si usas atributos en tu CSS: document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      // document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [dark]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        height: '3.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        flexShrink: 0,
        // 🔥 Reemplazado por variables del archivo CSS para que cambien solas
        borderBottom: '1px solid var(--color-card-border)',
        backgroundColor: 'var(--color-card-bg)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <button
        onClick={onMenuClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--color-gray-500)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-100)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {lowStockCount > 0 && (
          <button
            onClick={() => navigate('/productos')}
            style={{
              position: 'relative',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-warning)',
            }}
            title={`${lowStockCount} producto(s) con stock bajo`}
          >
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontSize: '1.25rem' }}>🔔</span>
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-4px',
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-warning)',
                }}
              />
            </span>
          </button>
        )}

        <button
          onClick={toggle}
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--color-gray-500)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-100)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Alternar modo oscuro"
        >
          {dark ? <Sun className="w-5 h-5" style={{ color: '#fbbf24' }} /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Perfil con dropdown conectado */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.75rem 0.25rem 0.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: dropdownOpen ? 'var(--color-gray-100)' : 'transparent',
              cursor: 'pointer',
              color: 'var(--color-gray-800)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!dropdownOpen) e.currentTarget.style.background = 'var(--color-gray-100)';
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-secondary)', /* Usa tu dorado identitario */
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Usuario'}
            </span>
            <ChevronDown
              style={{
                width: '1rem',
                height: '1rem',
                color: 'var(--color-gray-400)',
                transition: 'transform 0.2s',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </button>

          {/* Dropdown CONECTADO */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.15rem)',
                right: 0,
                minWidth: '100%',
                width: 'auto',
                backgroundColor: 'var(--color-card-bg)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-card-border)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                zIndex: 50,
              }}
            >
              {/* Triángulo superior */}
              <div
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '1.5rem',
                  width: '0',
                  height: '0',
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: '6px solid var(--color-card-bg)',
                  zIndex: 2,
                }}
              />
              {/* Borde del triángulo */}
              <div
                style={{
                  position: 'absolute',
                  top: '-7px',
                  right: '1.5rem',
                  width: '0',
                  height: '0',
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: '7px solid var(--color-card-border)',
                  zIndex: 1,
                }}
              />

              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: 'var(--color-gray-800)',
                  transition: 'background 0.15s, color 0.15s',
                  borderRadius: '0.5rem',
                  margin: '0.15rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-error-bg)';
                  e.currentTarget.style.color = 'var(--color-error-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-gray-800)';
                }}
              >
                <LogOut style={{ width: '1rem', height: '1rem', color: 'inherit' }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}