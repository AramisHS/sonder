import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  Loader2, ScanBarcode, CreditCard, Banknote, ArrowLeftRight, X, Package, Lock,
  PlusCircle, User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { logAudit } from '../../lib/audit';
import { notifyLowStock } from '../../lib/whatsapp';
import Modal from '../../components/Modal';
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

interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  notes: string;
}

const STORAGE_KEY = 'sonder_carts';

export default function NewSale() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [carts, setCarts] = useState<Cart[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { }
    }
    return [{ id: '1', name: 'Cliente 1', items: [], discount: 0, paymentMethod: 'efectivo', notes: '' }];
  });
  const [activeCartId, setActiveCartId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY + '_active');
    return stored || '1';
  });

  const [genericModalOpen, setGenericModalOpen] = useState(false);
  const [genericName, setGenericName] = useState('');
  const [genericPrice, setGenericPrice] = useState<number | ''>('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
  }, [carts]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_active', activeCartId);
  }, [activeCartId]);

  const activeCart = carts.find(c => c.id === activeCartId)!;
  const cartItems = activeCart.items;
  const discount = activeCart.discount;
  const paymentMethod = activeCart.paymentMethod;
  const notes = activeCart.notes;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addCart = () => {
    const newId = String(Date.now());
    setCarts([
      ...carts,
      {
        id: newId,
        name: `Cliente ${carts.length + 1}`,
        items: [],
        discount: 0,
        paymentMethod: 'efectivo',
        notes: '',
      },
    ]);
    setActiveCartId(newId);
  };

  const removeCart = (id: string) => {
    if (carts.length <= 1) return;
    const newCarts = carts.filter(c => c.id !== id);
    setCarts(newCarts);
    if (activeCartId === id) {
      setActiveCartId(newCarts[0].id);
    }
  };

  const updateCart = (id: string, updates: Partial<Cart>) => {
    setCarts(carts.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const clearCart = (id: string) => {
    setCarts(carts.map(c => c.id === id ? { ...c, items: [], discount: 0, notes: '' } : c));
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setError(`"${product.name}" no tiene stock disponible`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    setCarts(carts.map(c => {
      if (c.id !== activeCartId) return c;
      const existing = c.items.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock máximo disponible: ${product.stock} ${product.unit}`);
          setTimeout(() => setError(''), 3000);
          return c;
        }
        return {
          ...c,
          items: c.items.map(i =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
              : i
          )
        };
      }
      return {
        ...c,
        items: [...c.items, { product, quantity: 1, unit_price: product.sale_price, subtotal: product.sale_price }]
      };
    }));
    setSearch('');
  };

  const addGenericProduct = () => {
    if (!genericName.trim() || !genericPrice || genericPrice <= 0) {
      setError('Nombre y precio válidos requeridos');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const genericProduct: Product = {
      id: `generic-${Date.now()}`,
      name: genericName.trim(),
      barcode: null,
      category_id: null,
      supplier_id: null,
      purchase_price: 0,
      sale_price: genericPrice,
      stock: 999999,
      min_stock: 0,
      unit: 'pza',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCarts(carts.map(c => {
      if (c.id !== activeCartId) return c;
      const existing = c.items.find(i => i.product.id === genericProduct.id);
      if (existing) {
        return {
          ...c,
          items: c.items.map(i =>
            i.product.id === genericProduct.id
              ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
              : i
          )
        };
      }
      return {
        ...c,
        items: [...c.items, { product: genericProduct, quantity: 1, unit_price: genericProduct.sale_price, subtotal: genericProduct.sale_price }]
      };
    }));
    setGenericModalOpen(false);
    setGenericName('');
    setGenericPrice('');
  };

  const updateQty = (id: string, delta: number) => {
    setCarts(carts.map(c => {
      if (c.id !== activeCartId) return c;
      const item = c.items.find(i => i.product.id === id);
      if (!item) return c;
      const newQty = Math.max(1, Math.min(item.quantity + delta, item.product.stock));
      return {
        ...c,
        items: c.items.map(i =>
          i.product.id === id ? { ...i, quantity: newQty, subtotal: newQty * i.unit_price } : i
        )
      };
    }));
  };

  const removeItem = (id: string) => {
    setCarts(carts.map(c => {
      if (c.id !== activeCartId) return c;
      return { ...c, items: c.items.filter(i => i.product.id !== id) };
    }));
  };

  const subtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotal - discount);

  const handleSale = async () => {
    if (cartItems.length === 0) return;
    if (!profile) return;
    setSaving(true);
    setError('');

    const saleNumber = genSaleNumber();

    const realItems = cartItems
      .filter(item => !item.product.id.startsWith('generic-'))
      .map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

    const genericItems = cartItems.filter(item => item.product.id.startsWith('generic-'));

    let finalNotes = notes || '';
    if (genericItems.length > 0) {
      const genericList = genericItems
        .map(item => `${item.product.name} x${item.quantity} = ${fmt(item.subtotal)}`)
        .join(', ');
      finalNotes = finalNotes ? `${finalNotes} | Genéricos: ${genericList}` : `Genéricos: ${genericList}`;
    }

    const { data: saleId, error: err } = await supabase.rpc('process_sale', {
      p_sale_number: saleNumber,
      p_items: realItems,
      p_total: total,
      p_discount: discount,
      p_payment_method: paymentMethod,
      p_notes: finalNotes || null,
      p_user_id: profile.id,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    await logAudit(profile.id, 'SALE', 'sales', saleId, null, { sale_number: saleNumber, total });

    for (const item of cartItems) {
      if (item.product.id.startsWith('generic-')) continue;
      const { data: updatedProd } = await supabase
        .from('products')
        .select('stock, min_stock, name, unit')
        .eq('id', item.product.id)
        .single();
      if (updatedProd && updatedProd.stock <= updatedProd.min_stock) {
        notifyLowStock(updatedProd.name, updatedProd.stock, updatedProd.min_stock, updatedProd.unit);
      }
    }

    if (activeCartId === '1') {
      clearCart('1');
    } else {
      const newCarts = carts.filter(c => c.id !== activeCartId);
      setCarts(newCarts);
      if (newCarts.length > 0) {
        setActiveCartId(newCarts[0].id);
      } else {
        const freshCart = { id: '1', name: 'Cliente 1', items: [], discount: 0, paymentMethod: 'efectivo' as PaymentMethod, notes: '' };
        setCarts([freshCart]);
        setActiveCartId('1');
      }
    }

    const { data: freshProducts } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('status', 'active')
      .order('name');
    setProducts(freshProducts ?? []);

    setSaving(false);
    showToast(`Venta ${saleNumber} registrada por ${fmt(total)}`, 'success');
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

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

  const filtered = products.filter((p) => {
    const trimmed = search.trim();
    const isBarcode = /^\d{7,}$/.test(trimmed);
    if (isBarcode) {
      return true;
    }
    return [p.name, p.barcode].some((v) => v?.toLowerCase().includes(trimmed.toLowerCase()));
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';

      if (e.key === 'Enter' && active === searchRef.current) {
        e.preventDefault();
        const trimmed = search.trim();
        if (!trimmed) return;

        const isBarcode = /^\d{7,}$/.test(trimmed);

        if (isBarcode) {
          const exactProduct = products.find(p => p.barcode === trimmed);
          if (exactProduct) {
            addToCart(exactProduct);
          } else {
            setError(`No se encontró producto con código: ${trimmed}`);
            setTimeout(() => setError(''), 3000);
          }
          return;
        }

        if (filtered.length > 0) {
          addToCart(filtered[0]);
          setSearch('');
        } else {
          setError('No se encontró ningún producto con ese nombre');
          setTimeout(() => setError(''), 3000);
        }
        return;
      }

      if (isInput) return;

      if (e.key === 'g' || e.key === 'G') {
        setGenericModalOpen(true);
        e.preventDefault();
      } else if (e.key === 'n' || e.key === 'N') {
        addCart();
        e.preventDefault();
      } else if (e.key === 'c' || e.key === 'C') {
        handleSale();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filtered, products, addToCart, addCart, handleSale, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', height: '100%' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: toast.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: toast.type === 'success' ? 'var(--color-success-text)' : 'var(--color-error-text)',
          border: '1px solid var(--color-card-border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease',
          fontSize: '0.875rem',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Nueva venta</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
            Busca productos o agrega genéricos (Atajos: Enter, G, N, C)
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-card-border)',
        paddingBottom: '0.5rem',
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
          flex: 1,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-gray-300) transparent',
          WebkitOverflowScrolling: 'touch',
        }}>
          {carts.map((c, index) => {
            const isActive = activeCartId === c.id;
            const itemCount = c.items.reduce((sum, i) => sum + i.quantity, 0);
            const hasItems = itemCount > 0;

            return (
              <div
                key={c.id}
                onClick={() => setActiveCartId(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '0.5rem',
                  background: isActive ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: isActive ? '#fff' : 'var(--color-gray-700)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-gray-200)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-gray-100)';
                }}
              >
                <User style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 500 }}>
                  Cliente {index + 1}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.15rem',
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  background: hasItems ? (isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-info-bg)') : 'var(--color-gray-200)',
                  color: hasItems ? (isActive ? '#fff' : 'var(--color-primary)') : 'var(--color-gray-400)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                }}>
                  <ShoppingCart style={{ width: '0.5rem', height: '0.5rem' }} />
                  {itemCount}
                </span>
                {carts.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCart(c.id); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isActive ? '#fecaca' : 'var(--color-gray-400)',
                      cursor: 'pointer',
                      padding: '0.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.25rem',
                      marginLeft: '0.1rem',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = isActive ? '#fecaca' : 'var(--color-gray-400)'}
                  >
                    <X style={{ width: '0.65rem', height: '0.65rem' }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={addCart}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.7rem',
            borderRadius: '0.5rem',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.8rem',
            transition: 'background 0.15s',
            flexShrink: 0,
            marginLeft: '0.25rem',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-dark)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-primary)'}
        >
          <Plus style={{ width: '0.9rem', height: '0.9rem' }} /> Nuevo cliente
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <ScanBarcode style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-gray-400)' }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras..."
                className="input"
                style={{ paddingLeft: '2.25rem' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-gray-400)', cursor: 'pointer' }}
                >
                  <X style={{ width: '1rem', height: '1rem' }} />
                </button>
              )}
            </div>
            <button
              onClick={() => setGenericModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--color-info-bg)',
                color: 'var(--color-primary)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-info)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-info-bg)'}
            >
              <PlusCircle style={{ width: '1rem', height: '1rem' }} /> Genérico
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
            {filtered.slice(0, 50).map((p) => {
              const inCart = cartItems.find((i) => i.product.id === p.id);
              const isLowStock = p.stock <= p.min_stock && p.stock > 0;
              const isOutOfStock = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={isOutOfStock}
                  style={{
                    padding: '0.75rem',
                    border: inCart ? '2px solid var(--color-primary)' : '1px solid var(--color-card-border)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-card-bg)',
                    boxShadow: 'var(--shadow-sm)',
                    textAlign: 'left',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    opacity: isOutOfStock ? 0.5 : 1,
                    transition: 'box-shadow 0.15s, border-color 0.15s, background 0.25s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isOutOfStock) e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-800)' }}>{p.name}</span>
                    {inCart && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-info-bg)', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{(p as any).categories?.name ?? 'Sin cat.'}</span>
                    <span style={{ fontSize: '0.7rem', color: isOutOfStock ? 'var(--color-error)' : isLowStock ? 'var(--color-warning)' : 'var(--color-gray-500)', fontWeight: 500 }}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {fmt(p.sale_price)}
                  </div>
                  {isLowStock && <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', marginTop: '0.25rem' }}>⚠️ Stock bajo</div>}
                  {isOutOfStock && <div style={{ fontSize: '0.6rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>Sin stock</div>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: 'var(--color-gray-400)' }}>
                <Package style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                No se encontraron productos
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-card-bg)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-card-border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-card-border)' }}>
            <ShoppingCart style={{ width: '1rem', height: '1rem', color: 'var(--color-gray-500)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-gray-800)' }}>{activeCart.name}</span>
            {cartItems.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 500, background: 'var(--color-info-bg)', color: 'var(--color-primary)', padding: '0.125rem 0.625rem', borderRadius: '9999px' }}>
                {cartItems.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
            {cartItems.length > 0 && (
              <button
                onClick={() => clearCart(activeCartId)}
                style={{ background: 'none', border: 'none', color: 'var(--color-gray-400)', cursor: 'pointer', fontSize: '0.7rem', transition: 'color 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
              >
                Limpiar
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {error && (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error-text)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-gray-400)' }}>
                <ShoppingCart style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.875rem' }}>Carrito vacío</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Agrega productos o usa "Genérico"</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.product.id} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-gray-50)', border: '1px solid var(--color-card-border)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-gray-800)' }}>{item.product.name}</span>
                      {item.product.id.startsWith('generic-') && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-gray-500)', marginLeft: '0.5rem', background: 'var(--color-info-bg)', padding: '0.125rem 0.375rem', borderRadius: '9999px' }}>Genérico</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-gray-400)', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                    >
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        style={{ width: '1.5rem', height: '1.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-gray-200)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gray-600)' }}
                      >
                        <Minus style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                      <span style={{ width: '1.5rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-800)' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        style={{ width: '1.5rem', height: '1.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-gray-200)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gray-600)' }}
                      >
                        <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>× {fmt(item.unit_price)}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-primary)' }}>{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-card-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>Descuento</span>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateCart(activeCartId, { discount: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                min="0"
                style={{ width: '5rem', padding: '0.25rem 0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-card-border)', fontSize: '0.875rem', background: 'var(--color-card-bg)', color: 'var(--color-gray-800)' }}
                placeholder="0"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-gray-800)' }}>Total</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{fmt(total)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {PAYMENT_METHODS.map(({ value, label, icon: Icon, disabled: methodDisabled }) => (
                <button
                  key={value}
                  onClick={() => !methodDisabled && updateCart(activeCartId, { paymentMethod: value })}
                  disabled={methodDisabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: paymentMethod === value ? '2px solid var(--color-primary)' : '1px solid var(--color-card-border)',
                    background: paymentMethod === value ? 'var(--color-gray-50)' : 'var(--color-card-bg)',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: methodDisabled ? 'var(--color-gray-400)' : 'var(--color-gray-800)',
                    cursor: methodDisabled ? 'not-allowed' : 'pointer',
                    opacity: methodDisabled ? 0.6 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!methodDisabled && paymentMethod !== value) {
                      e.currentTarget.style.background = 'var(--color-gray-100)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!methodDisabled && paymentMethod !== value) {
                      e.currentTarget.style.background = 'var(--color-card-bg)';
                    }
                  }}
                >
                  {methodDisabled && (
                    <Lock style={{ width: '0.75rem', height: '0.75rem', position: 'absolute', top: '0.25rem', right: '0.25rem', color: 'var(--color-gray-400)' }} />
                  )}
                  <Icon style={{ width: '1rem', height: '1rem' }} />
                  <span>{label}</span>
                  {methodDisabled && <span style={{ fontSize: '0.6rem', color: 'var(--color-gray-400)' }}>Próximamente</span>}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={(e) => updateCart(activeCartId, { notes: e.target.value })}
              placeholder="Notas (opcional)"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-card-border)', fontSize: '0.875rem', resize: 'vertical', minHeight: '2.5rem', background: 'var(--color-gray-50)', color: 'var(--color-gray-800)' }}
            />

            <button
              onClick={handleSale}
              disabled={cartItems.length === 0 || saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: cartItems.length === 0 || saving ? 'not-allowed' : 'pointer',
                opacity: cartItems.length === 0 || saving ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!(cartItems.length === 0 || saving)) e.currentTarget.style.background = 'var(--color-primary-dark)';
              }}
              onMouseLeave={(e) => {
                if (!(cartItems.length === 0 || saving)) e.currentTarget.style.background = 'var(--color-primary)';
              }}
            >
              {saving ? <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ width: '1.25rem', height: '1.25rem' }} />}
              {saving ? 'Procesando...' : `Cobrar ${fmt(total)}`}
            </button>
          </div>
        </div>
      </div>

      <Modal open={genericModalOpen} onClose={() => setGenericModalOpen(false)} title="Agregar producto genérico" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Nombre del producto</label>
            <input
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="Ej: Jamón, Chorizo, Queso..."
              className="input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && genericPrice && genericPrice > 0) addGenericProduct();
              }}
            />
          </div>
          <div>
            <label className="label">Precio</label>
            <input
              value={genericPrice}
              onChange={(e) => setGenericPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && genericName.trim()) addGenericProduct();
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              onClick={() => setGenericModalOpen(false)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-gray-100)',
                color: 'var(--color-gray-700)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-gray-200)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-gray-100)'}
            >
              Cancelar
            </button>
            <button
              onClick={addGenericProduct}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-primary)'}
            >
              Agregar al carrito
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}