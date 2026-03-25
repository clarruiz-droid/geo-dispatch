-- ==========================================
-- SCRIPT CORREGIDO DE ROLES Y PERFILES
-- ==========================================

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS gd_roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- 'admin', 'driver', 'dispatcher'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insertar roles iniciales
INSERT INTO gd_roles (name, description) VALUES 
('admin', 'Administrador total del sistema'),
('driver', 'Chofer con acceso a reporte de GPS'),
('dispatcher', 'Despachador con acceso solo al mapa')
ON CONFLICT (name) DO NOTHING;

-- 3. Tabla de Perfiles vinculada a Auth y Roles (SIN subconsulta en DEFAULT)
CREATE TABLE IF NOT EXISTS gd_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role_id INTEGER REFERENCES gd_roles(id), -- El valor por defecto lo dará el trigger
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 4. Habilitar seguridad (RLS) para perfiles
ALTER TABLE gd_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON gd_profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Los admins pueden ver todos los perfiles" 
ON gd_profiles FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM gd_profiles p 
        JOIN gd_roles r ON p.role_id = r.id 
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- 5. Función para crear el perfil automáticamente al registrarse (AQUÍ asignamos el rol)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INTEGER;
BEGIN
    -- Buscamos el ID del rol 'driver' de forma segura
    SELECT id INTO default_role_id FROM gd_roles WHERE name = 'driver';

    INSERT INTO public.gd_profiles (id, email, full_name, role_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        default_role_id
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger que dispara la función anterior
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
