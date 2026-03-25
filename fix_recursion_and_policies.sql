-- ==========================================
-- SCRIPT PARA CORREGIR RECURSION INFINITA EN POLITICAS
-- ==========================================

-- 1. Crear una función de seguridad que rompa la recursión (SECURITY DEFINER)
-- Esta función verifica si un usuario es administrador sin disparar las políticas de RLS.
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

-- 2. Limpiar y actualizar políticas de PERFILES (gd_profiles)
DROP POLICY IF EXISTS "Allow admins to read all profiles" ON gd_profiles;
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON gd_profiles;
DROP POLICY IF EXISTS "Admins pueden actualizar perfiles" ON gd_profiles;

-- Política para lectura de admins
CREATE POLICY "Admins pueden ver todos los perfiles" 
ON gd_profiles FOR SELECT 
TO authenticated 
USING (is_admin());

-- Política para actualización de admins
CREATE POLICY "Admins pueden actualizar perfiles" 
ON gd_profiles FOR UPDATE 
TO authenticated 
USING (is_admin())
WITH CHECK (true);

-- 3. Limpiar y actualizar políticas de VEHICULOS (gd_vehicles)
DROP POLICY IF EXISTS "Todos ven flota" ON gd_vehicles;
DROP POLICY IF EXISTS "Solo admins pueden insertar vehículos" ON gd_vehicles;
DROP POLICY IF EXISTS "Solo admins pueden actualizar vehículos" ON gd_vehicles;
DROP POLICY IF EXISTS "Admins crean flota" ON gd_vehicles;
DROP POLICY IF EXISTS "Admins editan flota" ON gd_vehicles;

-- Lectura para todos los autenticados
CREATE POLICY "Todos ven flota" 
ON gd_vehicles FOR SELECT 
TO authenticated
USING (deleted_at IS NULL);

-- Inserción solo para admins
CREATE POLICY "Admins crean flota" 
ON gd_vehicles FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- Actualización solo para admins
CREATE POLICY "Admins editan flota" 
ON gd_vehicles FOR UPDATE 
TO authenticated 
USING (is_admin());
