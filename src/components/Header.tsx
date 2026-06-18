import { Menu, Moon, Sun, LogOut, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
  lowStockCount?: number;
}

export default function Header({ onMenuClick, lowStockCount = 0 }: HeaderProps) {
  const { dark, toggle } = useThemeStore();
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header style={{
      height: '3.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1rem',
      flexShrink: 0,
      borderBottom: '1px solid #e2e8f0',
      background: '#ffffff',
    }}>
      <button
        onClick={onMenuClick}
        style={{
          display: 'flex',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#64748b',
        }}
      >
        <Menu style={{ width: '1.25rem', height: '1.25rem' }} />
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {lowStockCount > 0 && (
          <button
            onClick={() => navigate('/productos')}
            style={{
              position: 'relative',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#d97706',
            }}
            title={`${lowStockCount} producto(s) con stock bajo`}
          >
            <Bell style={{ width: '1.25rem', height: '1.25rem' }} />
            <span style={{
              position: 'absolute',
              top: '0.375rem',
              right: '0.375rem',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: '#d97706',
            }} />
          </button>
        )}

        <button
          onClick={toggle}
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
          }}
          title="Alternar modo oscuro"
        >
          {dark ? <Sun style={{ width: '1.25rem', height: '1.25rem' }} /> : <Moon style={{ width: '1.25rem', height: '1.25rem' }} />}
        </button>

        <button
          onClick={handleSignOut}
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
          }}
          title="Cerrar sesión"
          onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <LogOut style={{ width: '1.25rem', height: '1.25rem' }} />
        </button>
      </div>
    </header>
  );
}