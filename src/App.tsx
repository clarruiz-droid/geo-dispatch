import { useState, useEffect, useRef } from 'react';
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
import { LogOut, Truck, Users, User, Eye, EyeOff, Clock, AlertTriangle, Bell, BellOff, Loader2 } from 'lucide-react';

// --- VISTA DEL ADMINISTRADOR ---
function AdminView() {
  const [activeTab, setActiveTab] = useState<'map' | 'management'>('map');
  const [managementTab, setManagementTab] = useState<'users' | 'vehicles' | 'history'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [, setProfiles] = useState<Profile[]>([]);
  const [statuses, setStatuses] = useState<(VehicleLocationStatus & { history: [number, number][]; is_offline?: boolean; is_alert?: boolean; profile?: { full_name: string } | null })[]>([]);
  const [visibleTrails, setVisibleTrails] = useState<Record<string, boolean>>({});
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [muteSiren, setMuteSiren] = useState(false);
  const [historicalTrail, setHistoricalTrail] = useState<{lat: number, lng: number, captured_at: string, vehicle_patente: string, chofer_name: string}[] | null>(null);
  const profilesRef = useRef<Profile[]>([]);

  useEffect(() => {
    const hasEmergency = statuses.some(s => s.is_emergency && !s.is_offline);
    const siren = document.getElementById('emergency-siren') as HTMLAudioElement;
    if (hasEmergency && !muteSiren) siren?.play().catch(() => {});
    else siren?.pause();
  }, [statuses, muteSiren]);

  const fetchInitialData = async () => {
    // 1. Cargar Vehículos y Perfiles
    const { data: vData } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
    const { data: pData } = await supabase.from('gd_profiles').select('*');
    if (pData) { setProfiles(pData); profilesRef.current = pData; }
    
    // 2. Cargar Estados Actuales
    const { data: sData } = await supabase.from('gd_vehicle_status').select('*, profile:updated_by(full_name)');
    
    // 3. Cargar Historial de 2h para los trails
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: hData } = await supabase.from('gd_gps_history').select('vehicle_id, lat, lng, captured_at').gte('captured_at', twoHoursAgo).order('captured_at', { ascending: true });

    if (vData) {
      setVehicles(vData);
      
      // 4. CONSTRUCCIÓN EXHAUSTIVA DE LA FLOTA
      const fleetStatuses = await Promise.all(vData.map(async (v) => {
        // Buscamos si tiene un estado actual
        const current = sData?.find(s => s.vehicle_id === v.id);
        
        let lat = current?.lat || null;
        let lng = current?.lng || null;
        let status = (current?.status as VehicleStatus) || 'standby';
        let isEmergency = current?.is_emergency || false;
        let updatedAt = current?.updated_at || v.created_at;
        let updatedBy = current?.updated_by || null;
        let profileInfo = current?.profile || null;

        // BÚSQUEDA PROFUNDA: Si no hay GPS en el estado, buscamos el ÚLTIMO histórico absoluto
        if (!lat || !lng) {
          const { data: lastGps } = await supabase
            .from('gd_gps_history')
            .select('lat, lng, profile_id')
            .eq('vehicle_id', v.id)
            .order('captured_at', { ascending: false })
            .limit(1);
          
          if (lastGps && lastGps.length > 0) {
            lat = lastGps[0].lat;
            lng = lastGps[0].lng;
            // Si no teníamos chofer, intentamos recuperarlo del historial
            if (!profileInfo && lastGps[0].profile_id) {
              const chofer = profilesRef.current.find(p => p.id === lastGps[0].profile_id);
              if (chofer) profileInfo = { full_name: chofer.full_name || 'Desconocido' };
            }
          }
        }

        const vehicleHistory = hData ? hData.filter(h => h.vehicle_id === v.id).map(h => [h.lat, h.lng] as [number, number]) : [];
        
        return {
          vehicle_id: v.id,
          status,
          lat,
          lng,
          is_emergency: isEmergency,
          updated_at: updatedAt,
          updated_by: updatedBy,
          created_at: v.created_at,
          deleted_at: null,
          created_by: null,
          history: vehicleHistory,
          is_offline: (Date.now() - new Date(updatedAt).getTime()) > 60000,
          profile: profileInfo
        };
      }));

      setStatuses(fleetStatuses);
    }
  };

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('fleet-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'gd_vehicle_status' }, (payload) => {
      const updated = payload.new as VehicleLocationStatus;
      setStatuses(prev => {
        const index = prev.findIndex(s => s.vehicle_id === updated.vehicle_id);
        const now = new Date().toISOString();
        const chofer = profilesRef.current.find(p => p.id === updated.updated_by);
        const profileInfo = chofer ? { full_name: chofer.full_name || 'Desconocido' } : null;
        
        if (index === -1) {
          return [...prev, { 
            ...updated, 
            profile: profileInfo, 
            history: updated.lat && updated.lng ? [[updated.lat, updated.lng]] : [], 
            updated_at: now 
          }];
        }

        const current = prev[index];
        const lat = updated.lat || current.lat;
        const lng = updated.lng || current.lng;

        // ACTUALIZACIÓN DE TRAIL: Solo añadimos al historial si la posición cambió
        const isNewPos = updated.lat !== current.lat || updated.lng !== current.lng;
        const newHistory = (updated.lat && updated.lng && isNewPos)
          ? [...current.history, [updated.lat, updated.lng] as [number, number]]
          : current.history;

        const newStatuses = [...prev];
        newStatuses[index] = { 
          ...current, 
          ...updated, 
          lat, 
          lng, 
          profile: profileInfo || current.profile, 
          history: newHistory.slice(-100), // Aumentamos a 100 puntos para un trail más largo
          updated_at: now, 
          is_offline: false 
        };
        return newStatuses;
      });
    }).subscribe();
    const offlineInterval = setInterval(() => {
      setStatuses(prev => prev.map(s => ({ ...s, is_offline: (Date.now() - new Date(s.updated_at).getTime()) > 60000 })));
    }, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(offlineInterval); };
  }, []);

  const toggleTrail = (vehicleId: string) => { setVisibleTrails(prev => ({ ...prev, [vehicleId]: !prev[vehicleId] })); };

  const handleAdminStatusChange = async (vehicleId: string, newStatus: VehicleStatus) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const current = statuses.find(s => s.vehicle_id === vehicleId);
    const { error } = await supabase.from('gd_vehicle_status').upsert({
      vehicle_id: vehicleId, status: newStatus, is_emergency: current?.is_emergency || false,
      updated_at: new Date().toISOString(), updated_by: session.user.id, lat: current?.lat, lng: current?.lng
    });
    if (!error) fetchInitialData();
  };

  const handleAdminEmergencyToggle = async (vehicleId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const current = statuses.find(s => s.vehicle_id === vehicleId);
    const { error } = await supabase.from('gd_vehicle_status').upsert({
      vehicle_id: vehicleId, status: current?.status || 'standby', is_emergency: !current?.is_emergency,
      updated_at: new Date().toISOString(), updated_by: session.user.id, lat: current?.lat, lng: current?.lng
    });
    if (!error) fetchInitialData();
  };

    const handleFetchTrail = async (vehicleId: string, startDate: string, endDate:string) => {
    try {
      const { data, error } = await supabase
        .from('gd_gps_history')
        .select('lat, lng')
        .eq('vehicle_id', vehicleId)
        .gte('captured_at', startDate)
        .lte('captured_at', endDate)
        .order('captured_at', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setHistoricalTrail(data.map(p => [p.lat, p.lng]));
        setActiveTab('map'); // Cambiar a la vista del mapa para ver el resultado
      } else {
        alert('No se encontraron datos de GPS para el vehículo en el rango de fechas seleccionado.');
        setHistoricalTrail(null);
      }
    } catch (err: any) {
      alert(`Error al buscar el recorrido: ${err.message}`);
      setHistoricalTrail(null);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 text-left">
      <audio id="emergency-siren" src="https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3" loop />
      <AdminNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'map' ? (
        <div className="flex flex-col flex-1 lg:flex-row overflow-hidden">
          <div className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-200 shadow-sm z-10 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flota en Tiempo Real</p>
                <button onClick={() => setMuteSiren(!muteSiren)} className={`p-1.5 rounded-lg transition-all ${muteSiren ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>{muteSiren ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>
              </div>
              {vehicles.map(v => {
                const s = statuses.find(stat => stat.vehicle_id === v.id);
                const isTrailVisible = visibleTrails[v.id];
                const isSelected = selectedVehicleId === v.id;
                return (
                  <div key={v.id} onClick={() => setSelectedVehicleId(v.id)} className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${s?.is_emergency ? 'bg-rose-50 border-rose-200 animate-pulse' : (isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-gray-200')}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-900">{v.patente}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s?.is_emergency ? 'bg-rose-600 text-white' : (s?.is_offline ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700')}`}>{s?.is_emergency ? 'SOS' : (s?.is_offline ? 'OFFLINE' : s?.status || 'SIN DATOS')}</span></div>
                        <p className="text-[10px] text-gray-500 font-medium truncate">{s?.profile?.full_name || 'Sin chofer'}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); toggleTrail(v.id); }} className={`p-1.5 rounded-md transition-all ${isTrailVisible ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:bg-gray-100'}`}>{isTrailVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                        <button onClick={(e) => { e.stopPropagation(); handleAdminEmergencyToggle(v.id); }} className={`p-1.5 rounded-md transition-all ${s?.is_emergency ? 'bg-rose-600 text-white' : 'text-rose-300 hover:bg-rose-50'}`}><AlertTriangle className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-gray-100/50">
                      {(['operativo', 'demora', 'standby', 'mtto'] as VehicleStatus[]).map((st) => (
                        <button key={st} onClick={(e) => { e.stopPropagation(); handleAdminStatusChange(v.id, st); }} className={`text-[9px] font-bold py-1 rounded transition-all uppercase ${s?.status === st ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>{st.slice(0, 4)}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex-1 relative"><DispatchMap vehicles={vehicles} selectedVehicleId={selectedVehicleId} statuses={statuses.map(s => ({ ...s, history: visibleTrails[s.vehicle_id] ? s.history : [] }))} historicalTrail={historicalTrail} /></div>
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
            {managementTab === 'history' && <StatusHistory onFetchTrail={handleFetchTrail} />}
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
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [status, setStatus] = useState<VehicleStatus>('standby');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastPos, setLastPos] = useState<{lat: number, lng: number} | null>(null);
  const skipNextUpdate = useRef(true);

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
          return s.updated_by === profileId || (now - new Date(s.updated_at).getTime()) > 300000;
        });
        setVehicles(available);
      }
    };
    fetchVehicles();
  }, [profileId]);

  const handleVehicleSelect = async (vehicle: Vehicle) => {
    setIsSyncing(true);
    skipNextUpdate.current = true;
    try {
      const { data, error } = await supabase.from('gd_vehicle_status').select('status, is_emergency, lat, lng').eq('vehicle_id', vehicle.id).single();
      if (!error && data) {
        setStatus(data.status as VehicleStatus);
        setIsEmergency(data.is_emergency);
        if (data.lat && data.lng) setLastPos({ lat: data.lat, lng: data.lng });
      }
      setSelectedVehicle(vehicle);
      localStorage.setItem('geo_dispatch_vehicle', JSON.stringify(vehicle));
      setTimeout(() => { skipNextUpdate.current = false; }, 1000);
    } catch (err) { setSelectedVehicle(vehicle); skipNextUpdate.current = false; }
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    if (!selectedVehicle || !profileId) return;

    const syncPendingData = async () => {
      if (!navigator.onLine) return;

      // 1. Sincronizar GPS
      const pendingGps = getPendingData();
      if (pendingGps.length > 0) {
        const { error: syncErr } = await supabase.from('gd_gps_history').insert(pendingGps.map(p => ({
          vehicle_id: selectedVehicle.id, profile_id: profileId, lat: p.lat, lng: p.lng, accuracy: p.accuracy, captured_at: new Date(p.timestamp).toISOString()
        })));
        if (!syncErr) clearPending();
      }

      // 2. Sincronizar Estados Pendientes
      const savedStates = localStorage.getItem('gd_pending_status');
      if (savedStates) {
        const pendingStates = JSON.parse(savedStates);
        if (pendingStates.length > 0) {
          const { error: stateErr } = await supabase.from('gd_vehicle_status').upsert(pendingStates);
          if (!stateErr) localStorage.removeItem('gd_pending_status');
        }
      }
    };

    const interval = setInterval(syncPendingData, 30000);
    window.addEventListener('online', syncPendingData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncPendingData);
    };
  }, [selectedVehicle, profileId, getPendingData, clearPending]);

  useEffect(() => {
    if (selectedVehicle && profileId && !skipNextUpdate.current) {
      const updateData: any = { 
        vehicle_id: selectedVehicle.id, 
        status, 
        is_emergency: isEmergency, 
        updated_at: new Date().toISOString(), 
        updated_by: profileId 
      };
      if (location) { updateData.lat = location.lat; updateData.lng = location.lng; }
      else if (lastPos) { updateData.lat = lastPos.lat; updateData.lng = lastPos.lng; }
      
      if (navigator.onLine) {
        supabase.from('gd_vehicle_status').upsert(updateData).then();
      } else {
        const saved = localStorage.getItem('gd_pending_status');
        const pending = saved ? JSON.parse(saved) : [];
        // Filtramos para mantener solo el último estado del vehículo actual si ya existía
        const filtered = pending.filter((p: any) => p.vehicle_id !== selectedVehicle.id);
        localStorage.setItem('gd_pending_status', JSON.stringify([...filtered, updateData]));
        console.log('[Status] Offline: Estado guardado localmente');
      }
    }
  }, [status, selectedVehicle, profileId, isEmergency, location, lastPos]);

  useEffect(() => { if (location) setLastPos({ lat: location.lat, lng: location.lng }); }, [location]);

  useEffect(() => {
    if (selectedVehicle && location && profileId && navigator.onLine) {
      supabase.from('gd_gps_history').insert({ vehicle_id: selectedVehicle.id, profile_id: profileId, lat: location.lat, lng: location.lng, accuracy: location.accuracy, captured_at: new Date(location.timestamp).toISOString() }).then();
    }
  }, [location, selectedVehicle, profileId]);

  const toggleEmergency = () => {
    if (skipNextUpdate.current) return;
    const next = !isEmergency;
    setIsEmergency(next);
    if (next && location && selectedVehicle && profileId) {
      supabase.from('gd_vehicle_status').upsert({ vehicle_id: selectedVehicle.id, status, lat: location.lat, lng: location.lng, is_emergency: true, updated_at: new Date().toISOString(), updated_by: profileId }).then();
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 min-h-screen bg-gray-50 text-left">
      {isTracking && <audio src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" autoPlay loop />}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl shadow-lg flex items-center justify-center text-white text-xl font-black">{fullName ? fullName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}</div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bienvenido</p>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{fullName || 'Chofer'}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isDbConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isDbConnected ? 'CONEXIÓN ONLINE' : 'MODO OFFLINE'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="p-3 text-gray-400 hover:text-rose-500 transition-all"><LogOut className="w-6 h-6" /></button>
      </header>
      {!selectedVehicle ? (
        <VehicleSelector vehicles={vehicles} onSelect={handleVehicleSelect} />
      ) : isSyncing ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="text-gray-500 font-bold animate-pulse">Sincronizando vehículo...</p></div>
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
          <button onClick={toggleEmergency} className={`w-full py-8 rounded-3xl font-black text-2xl flex flex-col items-center justify-center gap-2 shadow-2xl transition-all ${isEmergency ? 'bg-rose-600 text-white animate-pulse' : 'bg-white text-rose-600 border-4 border-rose-600'}`}><AlertTriangle className={`w-12 h-12 ${isEmergency ? 'animate-bounce' : ''}`} />{isEmergency ? 'EMERGENCIA ACTIVA' : 'BOTÓN DE PÁNICO'}</button>
          <GPSMonitor location={location} error={error} isTracking={isTracking} pendingCount={pendingCount} />
        </div>
      )}
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('gd_profiles').select('*, role:gd_roles(name)').eq('id', userId).single();
      if (!error) setProfile(data);
    } catch (err) {}
    finally { setLoading(false); }
  };

  useEffect(() => {
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
      </div>
    </Router>
  );
}
e path="/admin" element={<AdminView />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<DriverView profileId={session?.user?.id} fullName={profile?.full_name} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}
              <Route path="/" element={<DriverView profileId={session?.user?.id} fullName={profile?.full_name} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}
