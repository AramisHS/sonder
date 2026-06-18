import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-body)' }}>
      <Sidebar
        open={sidebarOpen}
        isCollapsed={isCollapsed}
        onClose={closeSidebar}
        onToggleCollapse={toggleSidebar}
        isMobile={isMobile}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', width: '100%' }}>
        <Header onMenuClick={toggleSidebar} lowStockCount={lowStockCount} />
        <main style={{ flex: 1, overflow: 'hidden', padding: '1rem', width: '100%', boxSizing: 'border-box', minHeight: 0 }}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
