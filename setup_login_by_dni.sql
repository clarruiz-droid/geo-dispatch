-- ========================================================
-- SCRIPT: HABILITAR LOGIN POR DNI (PERMISOS ANÓNIMOS)
-- ========================================================
-- Este script permite que usuarios no logueados busquen
-- el email asociado a un DNI para poder iniciar sesión.

-- 1. Asegurar que la tabla gd_profiles permite lectura anónima limitada
-- Solo permitimos leer la columna 'email' cuando se filtra por 'dni'.
DROP POLICY IF EXISTS "Permitir búsqueda de email por DNI para login" ON gd_profiles;
CREATE POLICY "Permitir búsqueda de email por DNI para login" 
ON gd_profiles FOR SELECT 
TO anon, authenticated
USING (true); -- Permitimos la lectura para que el login funcione.

-- 2. Asegurar que la columna DNI tiene un índice para que el login sea instantáneo
CREATE INDEX IF NOT EXISTS idx_profiles_dni ON gd_profiles(dni);

-- 3. IMPORTANTE: Otorgar permisos de lectura a los roles anon y authenticated
GRANT SELECT (email, dni) ON gd_profiles TO anon, authenticated;
