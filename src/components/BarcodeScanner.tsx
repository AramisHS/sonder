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
  const containerId = 'barcode-scanner-container';

  useEffect(() => {
    const startScan = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            onScan(decodedText);
            stopScan();
          },
          () => {}
        );
        setScanning(true);
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verifica los permisos.');
      }
    };
    startScan();

    return () => {
      stopScan();
    };
  }, []);

  const stopScan = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {}
    setScanning(false);
  };

  return (
    <div style={{
      padding: '1rem',
      border: '1px solid #edf2f7',
      borderRadius: '1rem',
      background: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera style={{ width: '1rem', height: '1rem', color: '#0b3b4c' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>Escanear código de barras</span>
        </div>
        <button
          onClick={() => { stopScan(); onClose(); }}
          style={{
            padding: '0.25rem',
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
      <div
        id={containerId}
        style={{
          width: '100%',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          minHeight: scanning ? '200px' : '0',
        }}
      />
      {!scanning && !error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 0',
          color: '#94a3b8',
        }}>
          <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
          Iniciando cámara...
        </div>
      )}
      {error && (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0',
          fontSize: '0.875rem',
          color: '#dc2626',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}