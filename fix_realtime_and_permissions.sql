-- ========================================================
-- SCRIPT: ACTIVACIÓN DEFINITIVA DE REALTIME (v0.5.4)
-- ========================================================

-- 1. Habilitar el envío de datos completos para que el mapa sepa qué cambió
ALTER TABLE gd_vehicle_status REPLICA IDENTITY FULL;

-- 2. Asegurar que la tabla esté en la publicación de Realtime de Supabase
-- Intentamos añadirla a la publicación estándar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gd_vehicle_status'
  ) THEN
    -- Si no existe la publicación la creamos, si existe añadimos la tabla
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE gd_vehicle_status;
    ELSE
      CREATE PUBLICATION supabase_realtime FOR TABLE gd_vehicle_status;
    END IF;
  END IF;
END $$;

-- 3. IMPORTANTE: Las políticas de seguridad (RLS) afectan al Realtime.
-- Si el admin no tiene permiso de SELECT, no recibirá actualizaciones.
DROP POLICY IF EXISTS "Admins ven estados en tiempo real" ON gd_vehicle_status;
CREATE POLICY "Admins ven estados en tiempo real" 
ON gd_vehicle_status FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM gd_profiles 
    WHERE id = auth.uid() 
    AND role_id = (SELECT id FROM gd_roles WHERE name = 'admin')
  )
);

-- 4. Dar permisos generales de lectura para evitar bloqueos
GRANT SELECT ON gd_vehicle_status TO authenticated;
