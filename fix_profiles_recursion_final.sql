-- ========================================================
-- SCRIPT: CORRECCIÓN FINAL DE RECURSIÓN EN PERFILES (v0.4.5)
-- ========================================================
-- Este script soluciona el error "infinite recursion detected"
-- utilizando la función is_admin() con privilegios de seguridad definidos.

-- 1. Asegurar la existencia de la función de seguridad que rompe la recursión
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.gd_profiles
    WHERE id = auth.uid()
    AND role_id = (SELECT id FROM public.gd_roles WHERE name = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpiar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON gd_profiles;
DROP POLICY IF EXISTS "Admins pueden actualizar perfiles" ON gd_profiles;
DROP POLICY IF EXISTS "Admins pueden borrar perfiles" ON gd_profiles;
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON gd_profiles;

-- 3. Crear nuevas políticas robustas basadas en la función is_admin()

-- LECTURA: Permite a los usuarios ver su propio perfil Y a los admins ver todos.
CREATE POLICY "Admins pueden ver todos los perfiles" 
ON gd_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id OR is_admin());

-- ACTUALIZACIÓN: Permite a los usuarios editar su propio perfil Y a los admins editar todos.
CREATE POLICY "Admins pueden actualizar perfiles" 
ON gd_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id OR is_admin())
WITH CHECK (true);

-- BORRADO: Únicamente los administradores pueden borrar perfiles.
CREATE POLICY "Admins pueden borrar perfiles" 
ON gd_profiles FOR DELETE 
TO authenticated 
USING (is_admin());

-- 4. Asegurar permisos de ejecución de la función
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
