import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  Loader2, ScanBarcode, CreditCard, Banknote, ArrowLeftRight, X, Package, Camera, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { logAudit } from '../../lib/audit';
import { notifyLowStock } from '../../lib/whatsapp';
import BarcodeScanner from '../../components/BarcodeScanner';
import type { Product, CartItem, PaymentMethod } from '../../lib/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; disabled?: boolean }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard, disabled: true },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
];

function genSaleNumber() {
  const now = new Date();
  return `VTA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

export default function NewSale() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('status', 'active')
        .order('name');
      setProducts(data ?? []);
    };
    fetch();
    searchRef.current?.focus();
  }, []);

  const filtered = products.filter((p) =>
    [p.name, p.barcode].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBarcodeScan = (code: string) => {
    const product = products.find((p) => p.barcode === code);
    if (product) {
      addToCart(product);
    } else {
      setError(`No se encontró producto con código: ${code}`);
      setTimeout(() => setError(''), 3000);
    }
    setScannerOpen(false);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setError(`"${product.name}" no tiene stock disponible`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock máximo disponible: ${product.stock} ${product.unit}`);
          setTimeout(() => setError(''), 3000);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
            : i
        );
      }
      return [...prev, { product, quantity: 1, unit_price: product.sale_price, subtotal: product.sale_price }];
    });
    setSearch('');
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== id) return i;
          const newQty = Math.max(1, Math.min(i.quantity + delta, i.product.stock));
          return { ...i, quantity: newQty, subtotal: newQty * i.unit_price };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const updatePrice = (id: string, price: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, unit_price: price, subtotal: i.quantity * price } : i
      )
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.product.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotal - discount);

  const handleSale = async () => {
    if (cart.length === 0) return;
    if (!profile) return;
    setSaving(true);
    setError('');

    const saleNumber = genSaleNumber();
    const items = cart.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
    }));

    const { data: saleId, error: err } = await supabase.rpc('process_sale', {
      p_sale_number: saleNumber,
      p_items: items,
      p_total: total,
      p_discount: discount,
      p_payment_method: paymentMethod,
      p_notes: notes || null,
      p_user_id: profile.id,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    await logAudit(profile.id, 'SALE', 'sales', saleId, null, { sale_number: saleNumber, total });

    // WhatsApp low stock notifications
    for (const item of cart) {
      const { data: updatedProd } = await supabase
        .from('products')
        .select('stock, min_stock, name, unit')
        .eq('id', item.product.id)
        .single();
      if (updatedProd && updatedProd.stock <= updatedProd.min_stock) {
        notifyLowStock(updatedProd.name, updatedProd.stock, updatedProd.min_stock, updatedProd.unit);
      }
    }

    setSuccess(true);
    setSaving(false);
    setCart([]);
    setDiscount(0);
    setNotes('');
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '5rem 0' }}>
        <div style={{ width: '4rem', height: '4rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#d1fae5' }}>
          <CheckCircle style={{ width: '2rem', height: '2rem', color: '#059669' }} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginTop: '1rem' }}>¡Venta registrada!</h2>
        <p style={{ marginTop: '0.25rem', marginBottom: '1.5rem', color: '#64748b' }}>La transacción fue procesada exitosamente.</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setSuccess(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              background: '#0b3b4c',
              color: '#ffffff',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <Plus style={{ width: '1rem', height: '1rem' }} /> Nueva venta
          </button>
          <button
            onClick={() => navigate('/ventas')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              background: '#f1f5f9',
              color: '#334155',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Ver historial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', height: '100%' }}>
      {/* Para pantallas grandes: dos columnas, para pequeñas: una columna */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        {/* Sección izquierda: búsqueda y lista de productos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Nueva venta</h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Busca productos para agregar al carrito</p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <ScanBarcode style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#94a3b8' }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras..."
                className="input"
                style={{ paddingLeft: '2.25rem' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X style={{ width: '1rem', height: '1rem' }} />
                </button>
              )}
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: '#f1f5f9',
                color: '#334155',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Escanear con cámara"
            >
              <Camera style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>

          {scannerOpen && (
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setScannerOpen(false)}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            {filtered.slice(0, 30).map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #edf2f7',
                    background: inCart ? '#fef3c7' : '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    textAlign: 'left',
                    cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                    opacity: p.stock > 0 ? 1 : 0.4,
                    transition: 'box-shadow 0.2s',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (p.stock > 0) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>{p.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{(p as { categories?: { name: string } }).categories?.name ?? 'Sin cat.'}</p>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: p.stock <= 0 ? '#fef2f2' : p.stock <= p.min_stock ? '#fef3c7' : '#f1f5f9',
                      color: p.stock <= 0 ? '#991b1b' : p.stock <= p.min_stock ? '#92400e' : '#475569',
                      flexShrink: 0,
                    }}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem', color: '#059669' }}>{fmt(p.sale_price)}</p>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <Package style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                No se encontraron productos
              </div>
            )}
          </div>
        </div>

        {/* Sección derecha: Carrito */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #edf2f7',
          borderRadius: '1rem',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          maxHeight: '500px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
            <ShoppingCart style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>Carrito</span>
            {cart.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', background: '#fef3c7', padding: '0.125rem 0.625rem', borderRadius: '9999px', fontWeight: 500, color: '#92400e' }}>
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {error && (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <ShoppingCart style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.875rem' }}>Carrito vacío</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', margin: 0 }}>{item.product.name}</p>
                    <button onClick={() => removeItem(item.product.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        style={{
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '0.25rem',
                          background: '#e2e8f0',
                          color: '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Minus style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                      <span style={{ width: '2rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        style={{
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '0.25rem',
                          background: '#e2e8f0',
                          color: '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$</span>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                        style={{
                          width: '5rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          color: '#1e293b',
                          fontSize: '0.75rem',
                          textAlign: 'right',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#64748b' }}>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#64748b', whiteSpace: 'nowrap' }}>Descuento</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                min="0"
                style={{
                  flex: 1,
                  padding: '0.375rem 0.5rem',
                  borderRadius: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '0.875rem',
                  textAlign: 'right',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>Total</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>{fmt(total)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {PAYMENT_METHODS.map(({ value, label, icon: Icon, disabled: methodDisabled }) => (
                <button
                  key={value}
                  onClick={() => !methodDisabled && setPaymentMethod(value)}
                  disabled={methodDisabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: paymentMethod === value ? '2px solid #b8860b' : '1px solid #e2e8f0',
                    background: paymentMethod === value ? '#fef3c7' : '#ffffff',
                    color: paymentMethod === value ? '#92400e' : methodDisabled ? '#94a3b8' : '#475569',
                    cursor: methodDisabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  {methodDisabled && (
                    <Lock style={{ position: 'absolute', top: '0.25rem', right: '0.25rem', width: '0.75rem', height: '0.75rem', color: '#94a3b8' }} />
                  )}
                  <Icon style={{ width: '1rem', height: '1rem' }} />
                  <span>{label}</span>
                  {methodDisabled && <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Próximamente</span>}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#1e293b',
                fontSize: '0.75rem',
                resize: 'vertical',
                minHeight: '3.5rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <button
              onClick={handleSale}
              disabled={cart.length === 0 || saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 0',
                borderRadius: '0.5rem',
                background: '#0b3b4c',
                color: '#ffffff',
                border: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: cart.length > 0 && !saving ? 'pointer' : 'not-allowed',
                opacity: cart.length > 0 && !saving ? 1 : 0.6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (cart.length > 0 && !saving) e.currentTarget.style.background = '#0a2f3d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0b3b4c';
              }}
            >
              {saving ? <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ width: '1.25rem', height: '1.25rem' }} />}
              {saving ? 'Procesando...' : `Cobrar ${fmt(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}