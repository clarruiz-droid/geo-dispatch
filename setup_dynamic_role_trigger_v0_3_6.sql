-- ========================================================
-- SCRIPT: GATILLO DINÁMICO POR NOMBRE DE ROL (v0.3.6)
-- ========================================================
-- Este script soluciona el error "Database error saving new user"
-- al buscar el ID del rol dinámicamente según el nombre.

-- 1. Limpiar rastro de funciones anteriores para evitar conflictos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Crear la función de gatillo inteligente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role_id INTEGER;
    v_role_name TEXT;
BEGIN
    -- Obtenemos el nombre del rol solicitado desde los metadatos del frontend
    -- Si no viene ninguno, por defecto será 'driver'
    v_role_name := COALESCE(new.raw_user_meta_data->>'role_name', 'driver');

    -- Buscamos el ID real en nuestra tabla de roles basado en ese nombre
    SELECT id INTO v_role_id FROM public.gd_roles WHERE name = v_role_name;

    -- Si por alguna razón el rol no existe, usamos el primero que encontremos como respaldo
    IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM public.gd_roles LIMIT 1;
    END IF;

    -- Insertamos el perfil con el ID de rol encontrado
    INSERT INTO public.gd_profiles (id, email, full_name, dni, role_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        new.raw_user_meta_data->>'dni',
        v_role_id
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        dni = EXCLUDED.dni,
        role_id = EXCLUDED.role_id,
        updated_at = now();
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el gatillo vinculado a la tabla de usuarios de Supabase
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Asegurar permisos de lectura
GRANT SELECT ON gd_profiles TO authenticated;
GRANT SELECT ON gd_roles TO authenticated;
