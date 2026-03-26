-- ========================================================
-- SCRIPT: LIMPIEZA TOTAL Y ARREGLO DE RECURSIÓN (NUCLEAR)
-- ========================================================
-- Este script elimina TODAS las políticas de la tabla gd_profiles 
-- y las recrea de forma segura usando una función que rompe el bucle.

-- 1. Desactivar RLS temporalmente para limpiar sin bloqueos
ALTER TABLE gd_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes en gd_profiles (sin importar el nombre)
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'gd_profiles' AND schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON gd_profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Asegurar que la función is_admin() sea ultra-segura y no recursiva
-- El truco aquí es 'SET search_path = public' para evitar confusiones de esquema
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role_id INTEGER;
BEGIN
    -- Buscamos el ID del rol admin directamente
    SELECT id INTO v_role_id FROM public.gd_roles WHERE name = 'admin' LIMIT 1;
    
    -- Verificamos el perfil del usuario logueado comparando con el ID del rol
    -- Importante: SECURITY DEFINER hace que esta consulta ignore las políticas de RLS
    RETURN EXISTS (
        SELECT 1 FROM public.gd_profiles
        WHERE id = auth.uid()
        AND role_id = v_role_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Volver a activar RLS
ALTER TABLE gd_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Crear las 3 políticas fundamentales de forma limpia

-- LECTURA: El usuario ve su perfil O el admin ve todo
CREATE POLICY "policy_profiles_select" 
ON gd_profiles FOR SELECT 
TO authenticated 
USING (id = auth.uid() OR is_admin());

-- ACTUALIZACIÓN: El usuario edita su perfil O el admin edita todo
CREATE POLICY "policy_profiles_update" 
ON gd_profiles FOR UPDATE 
TO authenticated 
USING (id = auth.uid() OR is_admin())
WITH CHECK (true);

-- BORRADO: Solo los administradores pueden borrar
CREATE POLICY "policy_profiles_delete" 
ON gd_profiles FOR DELETE 
TO authenticated 
USING (is_admin());

-- 6. Otorgar permisos de ejecución para estar seguros
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 7. REPARACIÓN FINAL: Asegurar que el usuario administrador actual tenga el rol correcto
-- Reemplaza con tu email si no es este
UPDATE gd_profiles 
SET role_id = (SELECT id FROM gd_roles WHERE name = 'admin')
WHERE email = 'admin@geodispatch.com';
