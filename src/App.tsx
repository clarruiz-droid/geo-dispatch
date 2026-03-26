import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { VehicleSelector } from './components/VehicleSelector';
import { StatusToggle } from './components/StatusToggle';
import { GPSMonitor } from './components/GPSMonitor';
import { useGeolocation } from './hooks/useGeolocation';
import { useWakeLock } from './hooks/useWakeLock';
import { DispatchMap } from './components/DispatchMap';
import { AdminNavbar } from './components/AdminNavbar';
import { UserManagement } from './components/UserManagement';
import { VehicleManagement } from './components/VehicleManagement';
import { StatusHistory } from './components/StatusHistory';
import type { Vehicle, VehicleStatus, VehicleLocationStatus, Profile } from './types';
import { LogOut, Truck, Users, User, Eye, EyeOff, Clock, AlertTriangle, Bell, BellOff } from 'lucide-react';

// --- VISTA DEL ADMINISTRADOR ---
function AdminView() {
  const [activeTab, setActiveTab] = useState<'map' | 'management'>('map');
  const [managementTab, setManagementTab] = useState<'users' | 'vehicles' | 'history'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<(VehicleLocationStatus & { history: [number, number][]; is_offline?: boolean; is_alert?: boolean })[]>([]);
  const [visibleTrails, setVisibleTrails] = useState<Record<string, boolean>>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [muteSiren, setMuteSiren] = useState(false);

  // Sirena de emergencia
  useEffect(() => {
    const hasEmergency = statuses.some(s => s.is_emergency && !s.is_offline);
    const siren = document.getElementById('emergency-siren') as HTMLAudioElement;
    
    if (hasEmergency && !muteSiren) {
      siren?.play().catch(() => {});
    } else {
      siren?.pause();
    }
  }, [statuses, muteSiren]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: vData } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
      if (vData) setVehicles(vData);

      const { data: sData } = await supabase.from('gd_vehicle_status').select('*, profile:updated_by(full_name)');
      
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: hData } = await supabase
        .from('gd_gps_history')
        .select('vehicle_id, lat, lng, captured_at')
        .gte('captured_at', twoHoursAgo)
        .order('captured_at', { ascending: true });

      if (sData) {
        setStatuses(sData.map(s => {
          const vehicleHistory = hData 
            ? hData.filter(h => h.vehicle_id === s.vehicle_id).map(h => [h.lat, h.lng] as [number, number])
            : [];
          
          return {
            ...s,
            history: vehicleHistory,
            is_offline: (Date.now() - new Date(s.last_updated || s.updated_at).getTime()) > 60000
          };
        }));
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gd_vehicle_status' }, () => {
          fetchInitialData();
      }).subscribe();

    const offlineInterval = setInterval(() => {
      setStatuses(prev => prev.map(s => ({ ...s, is_offline: (Date.now() - new Date(s.updated_at).getTime()) > 60000 })));
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(offlineInterval);
    };
  }, []);

  const toggleTrail = (vehicleId: string) => {
    setVisibleTrails(prev => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <audio id="emergency-siren" src="https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3" loop />
      <AdminNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {activeTab === 'map' ? (
        <div className="flex flex-col flex-1 lg:flex-row overflow-hidden">
          <div className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-200 shadow-sm z-10 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flota en Tiempo Real</p>
                <button 
                  onClick={() => setMuteSiren(!muteSiren)} 
                  className={`p-1.5 rounded-lg transition-all ${muteSiren ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'}`}
                >
                  {muteSiren ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>
              </div>
              {vehicles.map(v => {
                const s = statuses.find(stat => stat.vehicle_id === v.id);
                const isTrailVisible = visibleTrails[v.id];
                const isSelected = selectedVehicleId === v.id;

                return (
                  <div 
                    key={v.id} 
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex justify-between items-start group ${
                      s?.is_emergency ? 'bg-rose-50 border-rose-200 animate-pulse' : 
                      (isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-gray-200')
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-900">{v.patente}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          s?.is_emergency ? 'bg-rose-600 text-white' :
                          (s?.is_offline ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700')
                        }`}>
                          {s?.is_emergency ? 'SOS' : (s?.is_offline ? 'OFFLINE' : s?.status || 'SIN DATOS')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{v.modelo}</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleTrail(v.id); }}
                      className={`ml-3 p-2 rounded-lg transition-all ${isTrailVisible ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:bg-gray-100'}`}
                    >
                      {isTrailVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex-1 relative">
            <DispatchMap 
              vehicles={vehicles} 
              selectedVehicleId={selectedVehicleId}
              statuses={statuses.map(s => ({ ...s, history: visibleTrails[s.vehicle_id] ? s.history : [] }))} 
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
              <button onClick={() => setManagementTab('vehicles')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${managementTab === 'vehicles' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}><Truck className="w-5 h-5" /> Vehículos</button>
              <button onClick={() => setManagementTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${managementTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}><Users className="w-5 h-5" /> Usuarios</button>
              <button onClick={() => setManagementTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${managementTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}><Clock className="w-5 h-5" /> Historial</button>
            </div>
            {managementTab === 'vehicles' && <VehicleManagement />}
            {managementTab === 'users' && <UserManagement />}
            {managementTab === 'history' && <StatusHistory />}
          </div>
        </div>
      )}
    </div>
  );
}

// --- VISTA DEL CHOFER ---
function DriverView({ profileId, fullName }: { profileId?: string; fullName?: string | null }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(() => {
    const saved = localStorage.getItem('geo_dispatch_vehicle');
    return saved ? JSON.parse(saved) : null;
  });
  const [status, setStatus] = useState<VehicleStatus>(() => {
    return (localStorage.getItem('geo_dispatch_status') as VehicleStatus) || 'standby';
  });

  const isTracking = status === 'operativo' || status === 'demora';
  const { location, error, pendingCount, getPendingData, clearPending } = useGeolocation(isTracking);
  
  useWakeLock(isTracking);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data: allVehicles } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
      const { data: currentStatuses } = await supabase.from('gd_vehicle_status').select('vehicle_id, updated_at, updated_by');

      if (allVehicles) {
        const now = Date.now();
        const available = allVehicles.filter(v => {
          const s = currentStatuses?.find(st => st.vehicle_id === v.id);
          if (!s) return true;
          const lastUpdate = new Date(s.updated_at).getTime();
          return s.updated_by === profileId || (now - lastUpdate) > 300000;
        });
        setVehicles(available);
      }
    };
    fetchVehicles();
  }, [profileId]);

  useEffect(() => {
    if (!navigator.onLine || !selectedVehicle || !profileId) return;
    const syncPendingData = async () => {
      const pending = getPendingData();
      if (pending.length === 0) return;
      const { error: syncErr } = await supabase.from('gd_gps_history').insert(pending.map(p => ({
        vehicle_id: selectedVehicle.id, profile_id: profileId, lat: p.lat, lng: p.lng, accuracy: p.accuracy, captured_at: new Date(p.timestamp).toISOString()
      })));
      if (!syncErr) clearPending();
    };
    const interval = setInterval(syncPendingData, 30000);
    return () => clearInterval(interval);
  }, [selectedVehicle, profileId, getPendingData, clearPending]);

  useEffect(() => {
    if (selectedVehicle) localStorage.setItem('geo_dispatch_vehicle', JSON.stringify(selectedVehicle));
    else localStorage.removeItem('geo_dispatch_vehicle');
  }, [selectedVehicle]);

  useEffect(() => {
    if (selectedVehicle) {
      supabase.from('gd_vehicle_status').upsert({ 
        vehicle_id: selectedVehicle.id, status, is_emergency: isEmergency, updated_at: new Date().toISOString(), updated_by: profileId
      }).then();
    }
  }, [status, selectedVehicle, profileId, isEmergency]);

  useEffect(() => {
    if (selectedVehicle && location && navigator.onLine && profileId) {
      supabase.from('gd_vehicle_status').upsert({
        vehicle_id: selectedVehicle.id, status, lat: location.lat, lng: location.lng, updated_at: new Date().toISOString(), updated_by: profileId
      }).then();
      supabase.from('gd_gps_history').insert({
        vehicle_id: selectedVehicle.id, profile_id: profileId, lat: location.lat, lng: location.lng, accuracy: location.accuracy, captured_at: new Date(location.timestamp).toISOString()
      }).then();
    }
  }, [location, selectedVehicle, status, profileId]);

  const toggleEmergency = () => {
    const next = !isEmergency;
    setIsEmergency(next);
    if (next && location && selectedVehicle) {
      supabase.from('gd_vehicle_status').upsert({
        vehicle_id: selectedVehicle.id, status, lat: location.lat, lng: location.lng, is_emergency: true, updated_at: new Date().toISOString(), updated_by: profileId
      }).then();
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 min-h-screen bg-gray-50 text-left">
      {isTracking && <audio src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" autoPlay loop />}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl shadow-lg flex items-center justify-center text-white text-xl font-black">
            {fullName ? fullName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bienvenido</p>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{fullName || 'Chofer'}</h1>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="p-3 text-gray-400 hover:text-rose-500 transition-all"><LogOut className="w-6 h-6" /></button>
      </header>
      {!selectedVehicle ? (
        <VehicleSelector vehicles={vehicles} onSelect={setSelectedVehicle} />
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Truck className="w-5 h-5" /></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase">Vehículo Actual</p><p className="text-lg font-black text-gray-900">{selectedVehicle.patente}</p></div>
            </div>
            <button onClick={() => setSelectedVehicle(null)} className="text-sm text-blue-600 font-bold">Cambiar</button>
          </div>
          <StatusToggle currentStatus={status} onChange={setStatus} />
          <button onClick={toggleEmergency} className={`w-full py-8 rounded-3xl font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-2xl transition-all ${isEmergency ? 'bg-rose-600 text-white animate-pulse' : 'bg-white text-rose-600 border-4 border-rose-600'}`}>
            <AlertTriangle className={`w-12 h-12 ${isEmergency ? 'animate-bounce' : ''}`} />
            {isEmergency ? 'EMERGENCIA ACTIVA' : 'BOTÓN DE PÁNICO'}
          </button>
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
      try {
        const { data, error } = await supabase.from('gd_profiles').select('*, role:gd_roles(name)').eq('id', userId).single();
        if (error) console.error('Error de perfil:', error);
        setProfile(data);
      } catch (err) { console.error('Error inesperado:', err); }
      finally { setLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) { setLoading(true); fetchProfile(session.user.id); }
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!session) return <Login />;

  const userEmail = session.user.email?.toLowerCase().trim();
  const dbRole = profile?.role?.name?.toLowerCase().trim() || '';
  const isAdmin = userEmail === 'admin@geodispatch.com' || dbRole === 'admin';

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/admin" element={<AdminView />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<DriverView profileId={session?.user?.id} fullName={profile?.full_name} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
        {userEmail === 'admin@geodispatch.com' && !isAdmin && (
          <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-[10px] p-1 text-center font-mono z-[999]">
            DEBUG: Email={userEmail} | Role={dbRole} | ProfileLoaded={profile ? 'SI' : 'NO'}
          </div>
        )}
      </div>
    </Router>
  );
}
