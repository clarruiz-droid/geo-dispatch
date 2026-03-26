-- ========================================================
-- SCRIPT: REPARACIÓN MAESTRA DE REALTIME (v0.5.5)
-- ========================================================

-- 1. Desactivar temporalmente RLS para limpiar
ALTER TABLE gd_vehicle_status DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas previas de la tabla de estados
DO $$ 
DECLARE pol record;
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'gd_vehicle_status' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON gd_vehicle_status', pol.policyname);
    END LOOP;
END $$;

-- 3. Crear una política de lectura ULTRA-SIMPLE
-- Esto permite que cualquier usuario logueado vea los estados.
-- Es necesario porque Realtime falla con políticas que usan JOINs o funciones complejas.
CREATE POLICY "broad_select_status" ON gd_vehicle_status FOR SELECT TO authenticated USING (true);

-- 4. Política de escritura para choferes y admins
CREATE POLICY "broad_upsert_status" ON gd_vehicle_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Volver a activar RLS
ALTER TABLE gd_vehicle_status ENABLE ROW LEVEL SECURITY;

-- 6. RE-CONFIGURAR PUBLICACIÓN DE REALTIME
-- Borramos y recreamos para asegurar que no haya basura técnica
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE gd_vehicle_status, gd_vehicles;

-- 7. Asegurar Identidad de Réplica (Para que envíe los datos viejos y nuevos)
ALTER TABLE gd_vehicle_status REPLICA IDENTITY FULL;

-- 8. Permisos de sistema
GRANT ALL ON gd_vehicle_status TO authenticated;
GRANT ALL ON gd_vehicle_status TO service_role;
