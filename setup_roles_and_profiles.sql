-- ========================================================
-- SCRIPT: POLÍTICAS DE ACCESO TOTAL PARA ADMINS (v0.4.1)
-- ========================================================
-- Este script otorga permisos a los administradores para 
-- gestionar (Ver, Editar, Borrar) todos los perfiles.

-- 1. Asegurar que los perfiles tengan acceso a su propio dato
-- y los admins a todos los datos (LECTURA)
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON gd_profiles;
CREATE POLICY "Admins pueden ver todos los perfiles" 
ON gd_profiles FOR SELECT 
TO authenticated 
USING (
  (SELECT role_id FROM gd_profiles WHERE id = auth.uid()) = (SELECT id FROM gd_roles WHERE name = 'admin')
  OR id = auth.uid()
);

-- 2. Asegurar que los admins puedan EDITAR todos los perfiles
DROP POLICY IF EXISTS "Admins pueden actualizar perfiles" ON gd_profiles;
CREATE POLICY "Admins pueden actualizar perfiles" 
ON gd_profiles FOR UPDATE 
TO authenticated 
USING (
  (SELECT role_id FROM gd_profiles WHERE id = auth.uid()) = (SELECT id FROM gd_roles WHERE name = 'admin')
)
WITH CHECK (true);

-- 3. Asegurar que los admins puedan BORRAR perfiles
DROP POLICY IF EXISTS "Admins pueden borrar perfiles" ON gd_profiles;
CREATE POLICY "Admins pueden borrar perfiles" 
ON gd_profiles FOR DELETE 
TO authenticated 
USING (
  (SELECT role_id FROM gd_profiles WHERE id = auth.uid()) = (SELECT id FROM gd_roles WHERE name = 'admin')
);

-- 4. Reparación de datos: Asegurar que admin@geodispatch.com sea ADMIN
UPDATE gd_profiles 
SET role_id = (SELECT id FROM gd_roles WHERE name = 'admin')
WHERE email = 'admin@geodispatch.com';

-- 5. Reparación de datos: Asignar rol driver a quienes no tengan rol
UPDATE gd_profiles 
SET role_id = (SELECT id FROM gd_roles WHERE name = 'driver')
WHERE role_id IS NULL;
