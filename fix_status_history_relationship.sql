-- ========================================================
-- SCRIPT: CORRECCIÓN DE RELACIÓN PARA HISTORIAL (v0.4.9)
-- ========================================================
-- Este script vincula explícitamente el historial de estados
-- con la tabla de perfiles para permitir el listado de nombres.

-- 1. Eliminar la restricción antigua (que apuntaba a auth.users)
ALTER TABLE gd_status_history DROP CONSTRAINT IF EXISTS gd_status_history_profile_id_fkey;

-- 2. Crear la nueva restricción apuntando a gd_profiles
-- Ambas tablas comparten el mismo ID, pero esto habilita la unión en la API.
ALTER TABLE gd_status_history 
ADD CONSTRAINT gd_status_history_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES gd_profiles(id)
ON DELETE SET NULL;

-- 3. Notificar al cache de Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';
