import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Products from './pages/products/Products';
import Categories from './pages/categories/Categories';
import Suppliers from './pages/suppliers/Suppliers';
import InventoryEntries from './pages/inventory/InventoryEntries';
import InventoryAdjustments from './pages/inventory/InventoryAdjustments';
import NewSale from './pages/sales/NewSale';
import Sales from './pages/sales/Sales';
import CashRegisterClosing from './pages/cash/CashRegisterClosing';
import Movements from './pages/movements/Movements';
import Reports from './pages/reports/Reports';
import AuditLog from './pages/audit/AuditLog';
import Users from './pages/users/Users';
import { Loader2 } from 'lucide-react';

function ProtectedRoute() {
  const { session, loading } = useAuthStore();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-brand-600)' }} />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { profile } = useAuthStore();
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const { setSession, fetchProfile } = useAuthStore();
  const { dark } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        useAuthStore.setState({ loading: false });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          useAuthStore.setState({ profile: null, loading: false });
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/movimientos" element={<Movements />} />
            <Route path="/nueva-venta" element={<NewSale />} />
            <Route path="/ventas" element={<Sales />} />

            {/* Admin-only routes */}
            <Route element={<AdminRoute />}>
              <Route path="/categorias" element={<Categories />} />
              <Route path="/proveedores" element={<Suppliers />} />
              <Route path="/entradas" element={<InventoryEntries />} />
              <Route path="/ajustes" element={<InventoryAdjustments />} />
              <Route path="/corte-de-caja" element={<CashRegisterClosing />} />
              <Route path="/reportes" element={<Reports />} />
              <Route path="/auditoria" element={<AuditLog />} />
              <Route path="/usuarios" element={<Users />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
