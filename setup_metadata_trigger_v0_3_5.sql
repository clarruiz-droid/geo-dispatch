-- ========================================================
-- SCRIPT: GATILLO DE USUARIOS BASADO EN METADATOS (v0.3.5)
-- ========================================================
-- Este script permite que el DNI y el ROL se guarden 
-- automáticamente durante el registro inicial (SignUp).

-- 1. Asegurar columna DNI
ALTER TABLE gd_profiles ADD COLUMN IF NOT EXISTS dni TEXT;

-- 2. Función de gatillo mejorada (Captura datos de raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.gd_profiles (id, email, full_name, dni, role_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        new.raw_user_meta_data->>'dni', -- Captura el DNI de los metadatos enviados desde el frontend
        COALESCE(
            (new.raw_user_meta_data->>'role_id')::integer, 
            (SELECT id FROM gd_roles WHERE name = 'driver')
        ) -- Captura el Rol o usa chofer por defecto
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        dni = EXCLUDED.dni,
        role_id = EXCLUDED.role_id,
        updated_at = now();
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-vincular el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Permisos adicionales para asegurar la lectura de perfiles
GRANT SELECT ON gd_profiles TO authenticated;
GRANT SELECT ON gd_roles TO authenticated;
