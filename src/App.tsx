import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { VehicleSelector } from './components/VehicleSelector';
import { StatusToggle } from './components/StatusToggle';
import { GPSMonitor } from './components/GPSMonitor';
import { useGeolocation } from './hooks/useGeolocation';
import { DispatchMap } from './components/DispatchMap';
import type { Vehicle, VehicleStatus, VehicleLocationStatus, Profile } from './types';
import { LogOut, Truck, Shield } from 'lucide-react';

// --- VISTA DEL ADMINISTRADOR ---
function AdminView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<(VehicleLocationStatus & { history: [number, number][]; is_offline?: boolean; is_alert?: boolean })[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: vData } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
      if (vData) setVehicles(vData);

      const { data: sData } = await supabase.from('gd_vehicle_status').select('*');
      if (sData) {
        setStatuses(sData.map(s => ({
          ...s,
          history: s.lat && s.lng ? [[s.lat, s.lng]] : [],
          is_offline: (Date.now() - new Date(s.last_updated || s.updated_at).getTime()) > 60000
        })));
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gd_vehicle_status' }, (payload) => {
          const updated = payload.new as VehicleLocationStatus;
          setStatuses(prev => {
            const index = prev.findIndex(s => s.vehicle_id === updated.vehicle_id);
            const now = new Date().toISOString();
            if (index === -1) return [...prev, { ...updated, history: updated.lat && updated.lng ? [[updated.lat, updated.lng]] : [], updated_at: now }];
            const current = prev[index];
            const newHistory = updated.lat && updated.lng ? [...current.history.slice(-19), [updated.lat, updated.lng] as [number, number]] : current.history;
            const newStatuses = [...prev];
            newStatuses[index] = { ...updated, history: newHistory, updated_at: now, is_offline: false };
            return newStatuses;
          });
      }).subscribe();

    const offlineInterval = setInterval(() => {
      setStatuses(prev => prev.map(s => ({ ...s, is_offline: (Date.now() - new Date(s.updated_at).getTime()) > 60000 })));
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(offlineInterval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen lg:flex-row overflow-hidden bg-gray-50">
      <div className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-200 shadow-sm z-10 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-blue-600 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6" /> Admin
          </h1>
          <button onClick={() => supabase.auth.signOut()} className="p-2 text-gray-400 hover:text-rose-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flota en Tiempo Real</p>
          {vehicles.map(v => {
            const s = statuses.find(stat => stat.vehicle_id === v.id);
            return (
              <div key={v.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-gray-900">{v.patente}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s?.is_offline ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {s?.is_offline ? 'OFFLINE' : s?.status || 'SIN DATOS'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{v.modelo}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-1 relative"><DispatchMap vehicles={vehicles} statuses={statuses} /></div>
    </div>
  );
}

// --- VISTA DEL CHOFER ---
function DriverView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(() => {
    const saved = localStorage.getItem('geo_dispatch_vehicle');
    return saved ? JSON.parse(saved) : null;
  });
  const [status, setStatus] = useState<VehicleStatus>(() => {
    return (localStorage.getItem('geo_dispatch_status') as VehicleStatus) || 'standby';
  });

  const isTracking = status === 'operativo' || status === 'demora';
  const { location, error, pendingCount } = useGeolocation(isTracking);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
      if (data) setVehicles(data);
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicle) localStorage.setItem('geo_dispatch_vehicle', JSON.stringify(selectedVehicle));
    else localStorage.removeItem('geo_dispatch_vehicle');
  }, [selectedVehicle]);

  useEffect(() => {
    localStorage.setItem('geo_dispatch_status', status);
    if (selectedVehicle) {
      supabase.from('gd_vehicle_status').upsert({ vehicle_id: selectedVehicle.id, status, updated_at: new Date().toISOString() }).then();
    }
  }, [status, selectedVehicle]);

  useEffect(() => {
    if (selectedVehicle && location && navigator.onLine) {
      supabase.from('gd_vehicle_status').upsert({
        vehicle_id: selectedVehicle.id,
        status,
        lat: location.lat,
        lng: location.lng,
        updated_at: new Date().toISOString()
      }).then();
    }
  }, [location, selectedVehicle, status]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 min-h-screen bg-gray-50">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">GeoDispatch <span className="text-blue-600">Chofer</span></h1>
        <button onClick={() => supabase.auth.signOut()} className="p-2 text-gray-400 hover:text-rose-500"><LogOut className="w-5 h-5" /></button>
      </header>
      {!selectedVehicle ? (
        <VehicleSelector vehicles={vehicles} onSelect={setSelectedVehicle} />
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Truck className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vehículo Actual</p>
                <p className="text-lg font-black text-gray-900">{selectedVehicle.patente}</p>
              </div>
            </div>
            <button onClick={() => setSelectedVehicle(null)} className="text-sm text-blue-600 font-bold">Cambiar</button>
          </div>
          <StatusToggle currentStatus={status} onChange={setStatus} />
          <GPSMonitor location={location} error={error} isTracking={isTracking} pendingCount={pendingCount} />
        </div>
      )}
    </div>
  );
}

// --- APP PRINCIPAL CON AUTH Y ROLES ---
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from('gd_profiles')
        .select('*, role:gd_roles(name)')
        .eq('id', userId)
        .single();
      setProfile(data);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!session) return <Login />;

  const userRole = profile?.role?.name;

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Si es admin, puede elegir entre ver el mapa o la vista de chofer */}
          {userRole === 'admin' ? (
            <>
              <Route path="/admin" element={<AdminView />} />
              <Route path="/" element={<DriverView />} />
            </>
          ) : (
            // Si es chofer, solo ve la vista de chofer y el /admin redirige al home
            <>
              <Route path="/" element={<DriverView />} />
              <Route path="/admin" element={<Navigate to="/" />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}
