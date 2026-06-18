
/*
# MERCURIO - Schema inicial del Sistema Integral de Gestión Comercial

## Descripción
Crea todas las tablas necesarias para el sistema MERCURIO: perfiles, categorías, proveedores,
productos, entradas de inventario, ajustes, ventas, movimientos y auditoría.
Incluye funciones RPC para operaciones atómicas y triggers para automatización.

## Orden de creación
1. Tabla profiles (primero, para que get_my_role() la pueda referenciar)
2. Función helper get_my_role()
3. Resto de tablas con RLS basada en roles
4. Funciones RPC atómicas (process_inventory_entry, process_sale, etc.)
*/

-- ===================== PROFILES =====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role (después de crear profiles)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR get_my_role() = 'admin')
WITH CHECK (auth.uid() = id OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================== CATEGORIES =====================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
TO authenticated WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===================== SUPPLIERS =====================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
TO authenticated WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

DROP TRIGGER IF EXISTS suppliers_updated_at ON suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===================== PRODUCTS =====================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  barcode text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  stock numeric(12,2) NOT NULL DEFAULT 0,
  min_stock numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pieza',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
TO authenticated WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===================== INVENTORY ENTRIES =====================
CREATE TABLE IF NOT EXISTS inventory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  purchase_price numeric(12,2),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inv_entries_product_idx ON inventory_entries(product_id);
CREATE INDEX IF NOT EXISTS inv_entries_created_at_idx ON inventory_entries(created_at);

ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_entries_select" ON inventory_entries;
CREATE POLICY "inventory_entries_select" ON inventory_entries FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_entries_insert" ON inventory_entries;
CREATE POLICY "inventory_entries_insert" ON inventory_entries FOR INSERT
TO authenticated WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "inventory_entries_update" ON inventory_entries;
CREATE POLICY "inventory_entries_update" ON inventory_entries FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "inventory_entries_delete" ON inventory_entries;
CREATE POLICY "inventory_entries_delete" ON inventory_entries FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

-- ===================== INVENTORY ADJUSTMENTS =====================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity_before numeric(12,2) NOT NULL,
  quantity_after numeric(12,2) NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inv_adj_product_idx ON inventory_adjustments(product_id);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_adjustments_select" ON inventory_adjustments;
CREATE POLICY "inventory_adjustments_select" ON inventory_adjustments FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "inventory_adjustments_insert" ON inventory_adjustments;
CREATE POLICY "inventory_adjustments_insert" ON inventory_adjustments FOR INSERT
TO authenticated WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "inventory_adjustments_update" ON inventory_adjustments;
CREATE POLICY "inventory_adjustments_update" ON inventory_adjustments FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "inventory_adjustments_delete" ON inventory_adjustments;
CREATE POLICY "inventory_adjustments_delete" ON inventory_adjustments FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

-- ===================== SALES =====================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL,
  total numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo','tarjeta','transferencia','otro')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales(created_at);
CREATE INDEX IF NOT EXISTS sales_created_by_idx ON sales(created_by);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales FOR INSERT
TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_delete" ON sales FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

-- ===================== SALE ITEMS =====================
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items(product_id);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM sales WHERE id = sale_id AND created_by = auth.uid())
  OR get_my_role() = 'admin'
);

DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

-- ===================== INVENTORY MOVEMENTS =====================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  movement_type text NOT NULL CHECK (movement_type IN ('entry','sale','adjustment','return')),
  quantity numeric(12,2) NOT NULL,
  stock_before numeric(12,2) NOT NULL,
  stock_after numeric(12,2) NOT NULL,
  reference_id uuid,
  reference_type text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inv_movements_product_idx ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS inv_movements_created_at_idx ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS inv_movements_type_idx ON inventory_movements(movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movements_select" ON inventory_movements;
CREATE POLICY "movements_select" ON inventory_movements FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "movements_insert" ON inventory_movements;
CREATE POLICY "movements_insert" ON inventory_movements FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "movements_update" ON inventory_movements;
CREATE POLICY "movements_update" ON inventory_movements FOR UPDATE
TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "movements_delete" ON inventory_movements;
CREATE POLICY "movements_delete" ON inventory_movements FOR DELETE
TO authenticated USING (get_my_role() = 'admin');

-- ===================== AUDIT LOG =====================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_table_idx ON audit_log(table_name);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
TO authenticated USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_update" ON audit_log;
CREATE POLICY "audit_log_update" ON audit_log FOR UPDATE
TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "audit_log_delete" ON audit_log;
CREATE POLICY "audit_log_delete" ON audit_log FOR DELETE
TO authenticated USING (false);

-- ===================== RPC: process_inventory_entry =====================
CREATE OR REPLACE FUNCTION process_inventory_entry(
  p_product_id uuid,
  p_quantity numeric,
  p_purchase_price numeric,
  p_supplier_id uuid,
  p_notes text,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_entry_id uuid;
  v_stock_before numeric;
  v_stock_after numeric;
BEGIN
  SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id;
  v_stock_after := v_stock_before + p_quantity;

  INSERT INTO inventory_entries (product_id, quantity, purchase_price, supplier_id, notes, created_by)
  VALUES (p_product_id, p_quantity, p_purchase_price, p_supplier_id, p_notes, p_user_id)
  RETURNING id INTO v_entry_id;

  UPDATE products SET stock = v_stock_after, updated_at = now() WHERE id = p_product_id;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
  VALUES (p_product_id, 'entry', p_quantity, v_stock_before, v_stock_after, v_entry_id, 'inventory_entry', p_notes, p_user_id);

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================== RPC: process_inventory_adjustment =====================
CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_product_id uuid,
  p_new_quantity numeric,
  p_reason text,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_adj_id uuid;
  v_stock_before numeric;
BEGIN
  SELECT stock INTO v_stock_before FROM products WHERE id = p_product_id;

  INSERT INTO inventory_adjustments (product_id, quantity_before, quantity_after, reason, created_by)
  VALUES (p_product_id, v_stock_before, p_new_quantity, p_reason, p_user_id)
  RETURNING id INTO v_adj_id;

  UPDATE products SET stock = p_new_quantity, updated_at = now() WHERE id = p_product_id;

  INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
  VALUES (p_product_id, 'adjustment', p_new_quantity - v_stock_before, v_stock_before, p_new_quantity, v_adj_id, 'inventory_adjustment', p_reason, p_user_id);

  RETURN v_adj_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================== RPC: process_sale =====================
CREATE OR REPLACE FUNCTION process_sale(
  p_sale_number text,
  p_items jsonb,
  p_total numeric,
  p_discount numeric,
  p_payment_method text,
  p_notes text,
  p_user_id uuid
) RETURNS uuid AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_subtotal numeric;
  v_stock_before numeric;
  v_stock_after numeric;
  v_product_name text;
BEGIN
  INSERT INTO sales (sale_number, total, discount, payment_method, notes, created_by)
  VALUES (p_sale_number, p_total, p_discount, p_payment_method, p_notes, p_user_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_subtotal := (v_item->>'subtotal')::numeric;

    SELECT stock, name INTO v_stock_before, v_product_name FROM products WHERE id = v_product_id;

    IF v_stock_before < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %', v_product_name, v_stock_before, v_quantity;
    END IF;

    v_stock_after := v_stock_before - v_quantity;

    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_product_id, v_quantity, v_unit_price, v_subtotal);

    UPDATE products SET stock = v_stock_after, updated_at = now() WHERE id = v_product_id;

    INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
    VALUES (v_product_id, 'sale', -v_quantity, v_stock_before, v_stock_after, v_sale_id, 'sale', 'Venta #' || p_sale_number, p_user_id);
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================== RPC: get_dashboard_stats =====================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_products', (SELECT COUNT(*) FROM products WHERE status = 'active'),
    'low_stock_count', (SELECT COUNT(*) FROM products WHERE stock <= min_stock AND status = 'active'),
    'total_sales_today', (SELECT COALESCE(SUM(total), 0) FROM sales WHERE created_at::date = CURRENT_DATE),
    'total_sales_month', (SELECT COALESCE(SUM(total), 0) FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)),
    'sales_count_today', (SELECT COUNT(*) FROM sales WHERE created_at::date = CURRENT_DATE),
    'sales_count_month', (SELECT COUNT(*) FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)),
    'total_categories', (SELECT COUNT(*) FROM categories WHERE active = true),
    'total_suppliers', (SELECT COUNT(*) FROM suppliers WHERE active = true)
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
