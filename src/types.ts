export type VehicleStatus = 'operativo' | 'demora' | 'standby' | 'mtto';

export type AuditFields = {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type Vehicle = AuditFields & {
  id: string;
  patente: string;
  modelo: string | null;
}

export type VehicleLocationStatus = AuditFields & {
  vehicle_id: string;
  status: VehicleStatus;
  lat: number | null;
  lng: number | null;
  created_by: string | null;
  updated_by: string | null;
  is_emergency: boolean;
}

export type StatusLog = AuditFields & {
  id: number;
  vehicle_id: string;
  status: VehicleStatus;
  lat: number | null;
  lng: number | null;
  created_by: string | null;
}

export type Profile = AuditFields & {
  id: string;
  email: string;
  full_name: string | null;
  dni: string | null;
  role_id: number;
  role?: {
    name: string;
  };
}
