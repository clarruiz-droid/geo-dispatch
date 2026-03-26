-- ========================================================
-- SCRIPT: BOTÓN DE PÁNICO Y EMERGENCIAS (v0.5.0)
-- ========================================================

-- 1. Añadir columna de emergencia a la tabla de estados
ALTER TABLE gd_vehicle_status 
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;

-- 2. Añadir columna de emergencia al historial (opcional, para auditoría)
ALTER TABLE gd_status_history 
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false;

-- 3. Actualizar la función de log para capturar la emergencia
CREATE OR REPLACE FUNCTION public.log_vehicle_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Registramos si cambió el estado O si se activó/desactivó la emergencia
    IF (TG_OP = 'INSERT') OR 
       (OLD.status IS DISTINCT FROM NEW.status) OR 
       (OLD.is_emergency IS DISTINCT FROM NEW.is_emergency) THEN
        
        INSERT INTO public.gd_status_history (vehicle_id, status, profile_id, changed_at, is_emergency)
        VALUES (NEW.vehicle_id, NEW.status, NEW.updated_by, now(), NEW.is_emergency);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
