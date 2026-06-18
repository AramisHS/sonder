import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    const fetchLowStock = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, stock, min_stock')
        .eq('status', 'active');
      const low = (data ?? []).filter((p) => p.stock <= p.min_stock);
      setLowStockCount(low.length);
    };
    fetchLowStock();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-body)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', width: '100%' }}>
        <Header onMenuClick={() => setSidebarOpen(true)} lowStockCount={lowStockCount} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}