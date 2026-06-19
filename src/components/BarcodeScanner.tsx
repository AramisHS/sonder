import { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef(`barcode-scanner-${Date.now()}-${Math.random()}`).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const startScan = async () => {
      try {
        // Limpiar cualquier instancia previa
        if (scannerRef.current) {
          await scannerRef.current.clear();
        }
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText) => {
            if (isMounted.current) {
              onScan(decodedText);
              onClose();
            }
          },
          () => {} // Ignoramos errores de lectura (NotFoundException)
        );
        if (isMounted.current) setScanning(true);
      } catch (err) {
        console.error('Error al iniciar cámara:', err);
        if (isMounted.current) setError('No se pudo acceder a la cámara. Verifica los permisos.');
      }
    };
    startScan();

    return () => {
      isMounted.current = false;
      stopScan();
    };
  }, []);

  const stopScan = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current?.clear();
    } catch {}
    setScanning(false);
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--color-card-bg)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-card-border)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--color-gray-50)',
          borderBottom: '1px solid var(--color-card-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera style={{ width: '1rem', height: '1rem', color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-800)' }}>
            Escanear código de barras
          </span>
        </div>
        <button
          onClick={() => { stopScan(); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2rem',
            height: '2rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-gray-200)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-gray-600)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-gray-300)';
            e.currentTarget.style.color = 'var(--color-error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-gray-200)';
            e.currentTarget.style.color = 'var(--color-gray-600)';
          }}
        >
          <X style={{ width: '1rem', height: '1rem' }} />
        </button>
      </div>

      {/* Contenedor de la cámara con altura fija */}
      <div
        style={{
          width: '100%',
          height: scanning ? '240px' : '0',
          backgroundColor: '#000000',
          position: 'relative',
          overflow: 'hidden',
          transition: 'height 0.2s ease',
        }}
      >
        <div
          id={containerId}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        />
      </div>

      {/* Estados de carga / error */}
      {!scanning && !error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 0',
            color: 'var(--color-gray-500)',
            backgroundColor: 'var(--color-gray-50)',
          }}
        >
          <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
          <span>Iniciando cámara...</span>
        </div>
      )}
      {error && (
        <div
          style={{
            textAlign: 'center',
            padding: '1.5rem 0',
            fontSize: '0.875rem',
            color: 'var(--color-error-text)',
            backgroundColor: 'var(--color-gray-50)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}