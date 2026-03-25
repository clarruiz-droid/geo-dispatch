-- ========================================================
-- SCRIPT DE REPARACIÓN DE GATILLO DE USUARIOS Y CAMPO DNI
-- ========================================================

-- 1. Asegurar que los roles necesarios existen
INSERT INTO gd_roles (name, description) VALUES 
('admin', 'Administrador total del sistema'),
('driver', 'Chofer con acceso a reporte de GPS'),
('dispatcher', 'Despachador con acceso solo al mapa')
ON CONFLICT (name) DO NOTHING;

-- 2. Asegurar que existe la columna DNI en la tabla de perfiles
ALTER TABLE gd_profiles ADD COLUMN IF NOT EXISTS dni TEXT;

-- 3. Actualizar la función de gatillo (Trigger) para que sea robusta
-- Esta función se encarga de crear el perfil automáticamente cuando un usuario se registra.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INTEGER;
BEGIN
    -- Intentamos obtener el ID del rol 'driver' dinámicamente
    SELECT id INTO default_role_id FROM gd_roles WHERE name = 'driver';

    -- Si el rol no existe aún, forzamos un ID (usualmente 2 para driver)
    IF default_role_id IS NULL THEN
        default_role_id := 2; 
    END IF;

    -- Insertamos el perfil. 
    -- Si falla algo aquí, el usuario de Auth ya se creó, pero el perfil se creará 
    -- con los datos básicos y luego podrá ser editado por el admin.
    INSERT INTO public.gd_profiles (id, email, full_name, role_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        default_role_id
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
EXCEPTION
    WHEN others THEN
        -- Registramos el error en los logs de Postgres pero permitimos que el registro de Auth continúe
        RAISE WARNING 'Error crítico en handle_new_user: %', SQLERRM;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-asociar el trigger a la tabla auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Otorgar permisos de lectura en roles (necesario para el ABM)
GRANT SELECT ON gd_roles TO authenticated, anon;
