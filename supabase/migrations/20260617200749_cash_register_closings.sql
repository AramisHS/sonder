CREATE TABLE cash_register_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date date NOT NULL DEFAULT current_date,
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  cash_total numeric(12,2) NOT NULL DEFAULT 0,
  transfer_total numeric(12,2) NOT NULL DEFAULT 0,
  card_total numeric(12,2) NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cash_register_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_closings" ON cash_register_closings FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_closings" ON cash_register_closings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update_closings" ON cash_register_closings FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "delete_closings" ON cash_register_closings FOR DELETE
  TO authenticated USING (auth.uid() = created_by);
