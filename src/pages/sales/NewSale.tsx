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

    // WhatsApp low stock notifications for items that went low
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
      <div className="flex flex-col items-center justify-center h-full py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--color-success-50)' }}>
          <CheckCircle className="w-8 h-8" style={{ color: 'var(--color-success-600)' }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Venta registrada!</h2>
        <p className="mt-1 mb-6" style={{ color: 'var(--text-secondary)' }}>La transaccion fue procesada exitosamente.</p>
        <div className="flex gap-3">
          <button onClick={() => setSuccess(false)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Nueva venta
          </button>
          <button onClick={() => navigate('/ventas')} className="btn btn-secondary">
            Ver historial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full animate-fade-in">
      {/* Left: Product Search */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Nueva venta</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Busca productos para agregar al carrito</p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o codigo de barras..."
              className="input pl-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => setScannerOpen(true)} className="btn btn-secondary" title="Escanear con camara">
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {scannerOpen && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setScannerOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          {filtered.slice(0, 30).map((p) => {
            const inCart = cart.find((i) => i.product.id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className={`card p-3 text-left transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${inCart ? 'border-amber-400 dark:border-amber-600' : ''}`}
                style={inCart ? { background: 'var(--color-brand-50)' } : {}}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(p as { categories?: { name: string } }).categories?.name ?? 'Sin cat.'}</p>
                  </div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.stock <= 0 ? 'badge-error' : p.stock <= p.min_stock ? 'badge-warning' : 'badge-neutral'}`}>
                    {p.stock} {p.unit}
                  </span>
                </div>
                <p className="text-base font-bold mt-2" style={{ color: 'var(--color-success-600)' }}>{fmt(p.sale_price)}</p>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No se encontraron productos
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-96 flex flex-col card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <ShoppingCart className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Carrito</span>
          {cart.length > 0 && (
            <span className="ml-auto text-xs badge-brand px-2 py-0.5 rounded-full font-medium">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="px-3 py-2 rounded-lg text-xs badge-error">
              {error}
            </div>
          )}
          {cart.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Carrito vacio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--color-neutral-50)', borderColor: 'var(--border-color)', borderWidth: '1px' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{item.product.name}</p>
                  <button onClick={() => removeItem(item.product.id)} className="p-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 rounded flex items-center justify-center transition-colors" style={{ background: 'var(--color-neutral-200)', color: 'var(--text-secondary)' }}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 rounded flex items-center justify-center transition-colors" style={{ background: 'var(--color-neutral-200)', color: 'var(--text-secondary)' }}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs rounded text-right input"
                    />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(item.subtotal)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>Descuento</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              className="input text-right text-sm py-1.5"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Total</span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-success-600)' }}>{fmt(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon, disabled: methodDisabled }) => (
              <button
                key={value}
                onClick={() => !methodDisabled && setPaymentMethod(value)}
                disabled={methodDisabled}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all relative ${paymentMethod === value ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : ''}`}
                style={!methodDisabled && paymentMethod !== value ? { borderColor: 'var(--border-color)', color: 'var(--text-secondary)' } : methodDisabled ? { borderColor: 'var(--border-color)', color: 'var(--text-muted)', opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {methodDisabled && (
                  <Lock className="w-3 h-3 absolute top-1 right-1" style={{ color: 'var(--text-muted)' }} />
                )}
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {methodDisabled && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Proximamente</span>}
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="input resize-none h-14 text-xs"
          />

          <button
            onClick={handleSale}
            disabled={cart.length === 0 || saving}
            className="btn btn-primary w-full justify-center py-3 text-base"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            {saving ? 'Procesando...' : `Cobrar ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
