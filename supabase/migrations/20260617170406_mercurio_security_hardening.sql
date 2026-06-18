
/*
# MERCURIO - Security Hardening

## Changes
1. Fix mutable search_path on all functions by adding SET search_path = '' and using fully-qualified table names.
2. Revoke public/anon EXECUTE on all SECURITY DEFINER functions; grant only to authenticated where needed.
3. Tighten RLS INSERT policies on audit_log and inventory_movements (remove always-true WITH CHECK).
*/

-- ===================== 1. FIX SEARCH PATH — recreate all functions with SET search_path = '' =====================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_profile_count int;
BEGIN
  SELECT COUNT(*) INTO v_profile_count FROM public.profiles;
  IF v_profile_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
  END IF;
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_inventory_entry(
  p_product_id uuid,
  p_quantity numeric,
  p_purchase_price numeric,
  p_supplier_id uuid,
  p_notes text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id uuid;
  v_stock_before numeric;
  v_stock_after numeric;
BEGIN
  SELECT stock INTO v_stock_before FROM public.products WHERE id = p_product_id;
  v_stock_after := v_stock_before + p_quantity;

  INSERT INTO public.inventory_entries (product_id, quantity, purchase_price, supplier_id, notes, created_by)
  VALUES (p_product_id, p_quantity, p_purchase_price, p_supplier_id, p_notes, p_user_id)
  RETURNING id INTO v_entry_id;

  UPDATE public.products SET stock = v_stock_after, updated_at = now() WHERE id = p_product_id;

  INSERT INTO public.inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
  VALUES (p_product_id, 'entry', p_quantity, v_stock_before, v_stock_after, v_entry_id, 'inventory_entry', p_notes, p_user_id);

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
  p_product_id uuid,
  p_new_quantity numeric,
  p_reason text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_adj_id uuid;
  v_stock_before numeric;
BEGIN
  SELECT stock INTO v_stock_before FROM public.products WHERE id = p_product_id;

  INSERT INTO public.inventory_adjustments (product_id, quantity_before, quantity_after, reason, created_by)
  VALUES (p_product_id, v_stock_before, p_new_quantity, p_reason, p_user_id)
  RETURNING id INTO v_adj_id;

  UPDATE public.products SET stock = p_new_quantity, updated_at = now() WHERE id = p_product_id;

  INSERT INTO public.inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
  VALUES (p_product_id, 'adjustment', p_new_quantity - v_stock_before, v_stock_before, p_new_quantity, v_adj_id, 'inventory_adjustment', p_reason, p_user_id);

  RETURN v_adj_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sale(
  p_sale_number text,
  p_items jsonb,
  p_total numeric,
  p_discount numeric,
  p_payment_method text,
  p_notes text,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  INSERT INTO public.sales (sale_number, total, discount, payment_method, notes, created_by)
  VALUES (p_sale_number, p_total, p_discount, p_payment_method, p_notes, p_user_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_subtotal   := (v_item->>'subtotal')::numeric;

    SELECT stock, name INTO v_stock_before, v_product_name FROM public.products WHERE id = v_product_id;

    IF v_stock_before < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %', v_product_name, v_stock_before, v_quantity;
    END IF;

    v_stock_after := v_stock_before - v_quantity;

    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_product_id, v_quantity, v_unit_price, v_subtotal);

    UPDATE public.products SET stock = v_stock_after, updated_at = now() WHERE id = v_product_id;

    INSERT INTO public.inventory_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_by)
    VALUES (v_product_id, 'sale', -v_quantity, v_stock_before, v_stock_after, v_sale_id, 'sale', 'Venta #' || p_sale_number, p_user_id);
  END LOOP;

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_products',    (SELECT COUNT(*) FROM public.products WHERE status = 'active'),
    'low_stock_count',   (SELECT COUNT(*) FROM public.products WHERE stock <= min_stock AND status = 'active'),
    'total_sales_today', (SELECT COALESCE(SUM(total), 0) FROM public.sales WHERE created_at::date = CURRENT_DATE),
    'total_sales_month', (SELECT COALESCE(SUM(total), 0) FROM public.sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)),
    'sales_count_today', (SELECT COUNT(*) FROM public.sales WHERE created_at::date = CURRENT_DATE),
    'sales_count_month', (SELECT COUNT(*) FROM public.sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)),
    'total_categories',  (SELECT COUNT(*) FROM public.categories WHERE active = true),
    'total_suppliers',   (SELECT COUNT(*) FROM public.suppliers WHERE active = true)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- ===================== 2. FIX EXECUTE PERMISSIONS =====================

-- Revoke from public (covers both anon and authenticated) and anon explicitly
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_inventory_entry(uuid, numeric, numeric, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_inventory_adjustment(uuid, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_sale(text, jsonb, numeric, numeric, text, text, uuid) FROM PUBLIC, anon;

-- Grant only to authenticated for the RPCs called from the frontend
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_entry(uuid, numeric, numeric, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_adjustment(uuid, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sale(text, jsonb, numeric, numeric, text, text, uuid) TO authenticated;

-- Internal helper used by RLS policies — postgres role needs it; do not expose to REST clients
-- (get_my_role is called server-side only, no REST grant needed)
-- handle_new_user and update_updated_at are trigger functions only

-- ===================== 3. FIX ALWAYS-TRUE RLS INSERT POLICIES =====================

-- audit_log: only let authenticated users insert rows attributed to themselves
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- inventory_movements: rows are created by SECURITY DEFINER RPCs (which bypass RLS);
-- direct inserts from the client must attribute the row to the authenticated user
DROP POLICY IF EXISTS "movements_insert" ON public.inventory_movements;
CREATE POLICY "movements_insert" ON public.inventory_movements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
