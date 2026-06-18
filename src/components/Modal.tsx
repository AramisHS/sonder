import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: { maxWidth: '24rem' },
  md: { maxWidth: '28rem' },
  lg: { maxWidth: '32rem' },
  xl: { maxWidth: '42rem' },
};

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: sizes[size].maxWidth,
          borderRadius: '1.5rem',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          border: '1px solid #edf2f7',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1e293b',
          }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              padding: '0.375rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}