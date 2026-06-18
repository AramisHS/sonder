export type UserRole = 'admin' | 'employee';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  purchase_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  categories?: Category | null;
  suppliers?: Supplier | null;
}

export interface InventoryEntry {
  id: string;
  product_id: string;
  quantity: number;
  purchase_price: number | null;
  supplier_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: Product | null;
  suppliers?: Supplier | null;
  profiles?: Profile | null;
}

export interface InventoryAdjustment {
  id: string;
  product_id: string;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  products?: Product | null;
  profiles?: Profile | null;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

export interface Sale {
  id: string;
  sale_number: string;
  total: number;
  discount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: Profile | null;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  products?: Product | null;
}

export type MovementType = 'entry' | 'sale' | 'adjustment' | 'return';

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: Product | null;
  profiles?: Profile | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profiles?: Profile | null;
}

export interface DashboardStats {
  total_products: number;
  low_stock_count: number;
  total_sales_today: number;
  total_sales_month: number;
  sales_count_today: number;
  sales_count_month: number;
  total_categories: number;
  total_suppliers: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
