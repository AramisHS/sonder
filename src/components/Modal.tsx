import { useEffect, type ReactNode } from 'react';

interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; }

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal-window modal-${size}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>

        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}