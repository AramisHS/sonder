
/*
# MERCURIO - Primer usuario como administrador

El primer usuario que se registre en el sistema será automáticamente administrador.
Los siguientes usuarios serán empleados por defecto (el admin puede cambiar sus roles).
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_profile_count int;
BEGIN
  SELECT COUNT(*) INTO v_profile_count FROM profiles;
  IF v_profile_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
  END IF;

  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
