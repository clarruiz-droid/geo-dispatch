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
  const [isDbConnected, setIsDbConnected] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const profilesRef = useRef<Profile[]>([]);

  // Verificación de conexión real con la DB
  useEffect(() => {
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsDbConnected(false);
        return;
      }
      try {
        const { error } = await supabase.from('gd_profiles').select('id', { count: 'exact', head: true }).limit(1);
        setIsDbConnected(!error);
      } catch {
        setIsDbConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    window.addEventListener('online', () => {
      checkConnection();
      fetchInitialData();
    });
    window.addEventListener('offline', () => setIsDbConnected(false));

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', () => setIsDbConnected(false));
    };
  }, []);

  useEffect(() => {
    const hasEmergency = statuses.some(s => s.is_emergency && !s.is_offline);
    const siren = document.getElementById('emergency-siren') as HTMLAudioElement;
    if (hasEmergency && !muteSiren) siren?.play().catch(() => {});
    else siren?.pause();
  }, [statuses, muteSiren]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Cargar Vehículos y Perfiles
      const { data: vData } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null);
      const { data: pData } = await supabase.from('gd_profiles').select('*');
      
      // Guardamos perfiles en el Ref para acceso rápido en tiempo real
      if (pData) { 
        setProfiles(pData); 
        profilesRef.current = pData; 
      }
      
      // 2. Cargar Estados Actuales (Sin join complejo para evitar errores de relación)
      const { data: sData } = await supabase.from('gd_vehicle_status').select('*');
      
      // 3. Cargar Historial de 2h para los trails
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: hData } = await supabase.from('gd_gps_history').select('vehicle_id, lat, lng, captured_at').gte('captured_at', twoHoursAgo).order('captured_at', { ascending: true });

      if (vData) {
        setVehicles(vData);
        
        // 4. CONSTRUCCIÓN DE LA FLOTA
        const fleetStatuses = vData.map((v) => {
          const current = sData?.find(s => s.vehicle_id === v.id);
          
          const lat = current?.lat || null;
          const lng = current?.lng || null;
          const status = (current?.status as VehicleStatus) || 'standby';
          const isEmergency = current?.is_emergency || false;
          const updatedAt = current?.updated_at || v.created_at;
          const updatedBy = current?.updated_by || null;
          
          // Buscar nombre del chofer en pData (gd_profiles) usando updated_by (auth.users id)
          const chofer = pData?.find(p => p.id === updatedBy);
          const profileInfo = chofer ? { full_name: chofer.full_name || 'Desconocido' } : null;

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
        });

        setStatuses(fleetStatuses);
      }
    } catch (err) {
      console.error("Error fetching initial data", err);
    } finally {
      setIsLoading(false);
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

  const handleFetchTrail = async (vehicleId: string, startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from('gd_gps_history')
        .select('lat, lng, captured_at, profile_id')
        .eq('vehicle_id', vehicleId)
        .gte('captured_at', startDate)
        .lte('captured_at', endDate)
        .order('captured_at', { ascending: true });

      if (error) throw error;
      
      const vehicle = vehicles.find(v => v.id === vehicleId);
      
      if (data && data.length > 0) {
        setHistoricalTrail(data.map(p => ({
          lat: p.lat,
          lng: p.lng,
          captured_at: p.captured_at,
          vehicle_patente: vehicle?.patente || 'Desconocido',
          chofer_name: profilesRef.current.find(prof => prof.id === p.profile_id)?.full_name || 'Desconocido'
        })));
        setActiveTab('map');
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
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flota en Tiempo Real</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-tighter ${isDbConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isDbConnected ? 'Panel Online' : 'Modo Offline'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setMuteSiren(!muteSiren)} className={`p-1.5 rounded-lg transition-all ${muteSiren ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>{muteSiren ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase animate-pulse">Sincronizando flota...</p>
                </div>
              ) : vehicles.map(v => {
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
  const [isDbConnected, setIsDbConnected] = useState(navigator.onLine);
  const skipNextUpdate = useRef(true);

  const isTracking = status === 'operativo' || status === 'demora';
  const { location, error, pendingCount, getPendingData, clearPending } = useGeolocation(isTracking);
  useWakeLock(isTracking);

  // Verificación de conexión real con la DB
  useEffect(() => {
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsDbConnected(false);
        return;
      }
      try {
        const { error } = await supabase.from('gd_profiles').select('id', { count: 'exact', head: true }).limit(1);
        setIsDbConnected(!error);
      } catch {
        setIsDbConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', () => setIsDbConnected(false));

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', () => setIsDbConnected(false));
    };
  }, []);

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

      // 2. Sincronizar Historial de Estados (gd_status_history)
      const savedHistory = localStorage.getItem('gd_pending_status_history');
      if (savedHistory) {
        const pendingHistory = JSON.parse(savedHistory);
        if (pendingHistory.length > 0) {
          const { error: histErr } = await supabase.from('gd_status_history').insert(pendingHistory);
          if (!histErr) localStorage.removeItem('gd_pending_status_history');
        }
      }

      // 3. Sincronizar Estado Actual (gd_vehicle_status)
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
      const now = new Date().toISOString();
      const updateData: any = { 
        vehicle_id: selectedVehicle.id, 
        status, 
        is_emergency: isEmergency, 
        updated_at: now, 
        updated_by: profileId 
      };
      
      if (location) { updateData.lat = location.lat; updateData.lng = location.lng; }
      else if (lastPos) { updateData.lat = lastPos.lat; updateData.lng = lastPos.lng; }

      const historyData = {
        vehicle_id: selectedVehicle.id,
        profile_id: profileId,
        status,
        changed_at: now,
        lat: updateData.lat,
        lng: updateData.lng
      };
      
      if (navigator.onLine) {
        // Guardado doble: Estado actual e Historial
        supabase.from('gd_vehicle_status').upsert(updateData).then();
        supabase.from('gd_status_history').insert(historyData).then();
      } else {
        // Store & Forward: Estado Actual (para sobreescribir el último)
        const savedStatus = localStorage.getItem('gd_pending_status');
        const pendingStatus = savedStatus ? JSON.parse(savedStatus) : [];
        const filteredStatus = pendingStatus.filter((p: any) => p.vehicle_id !== selectedVehicle.id);
        localStorage.setItem('gd_pending_status', JSON.stringify([...filteredStatus, updateData]));

        // Store & Forward: Historial (para acumular todos los cambios)
        const savedHist = localStorage.getItem('gd_pending_status_history');
        const pendingHist = savedHist ? JSON.parse(savedHist) : [];
        localStorage.setItem('gd_pending_status_history', JSON.stringify([...pendingHist, historyData]));
        
        console.log('[Status] Offline: Datos guardados localmente');
      }
    }
  }, [status, selectedVehicle, profileId, isEmergency, location, lastPos]);

  useEffect(() => { if (location) setLastPos({ lat: location.lat, lng: location.lng }); }, [location]);

  useEffect(() => {
    if (selectedVehicle && location && profileId && navigator.onLine) {
      const now = new Date(location.timestamp).toISOString();
      // 1. Insertar en Historial GPS
      supabase.from('gd_gps_history').insert({ 
        vehicle_id: selectedVehicle.id, 
        profile_id: profileId, 
        lat: location.lat, 
        lng: location.lng, 
        accuracy: location.accuracy, 
        captured_at: now 
      }).then();

      // 2. Actualizar Ubicación Actual en Vehicle Status
      supabase.from('gd_vehicle_status').upsert({
        vehicle_id: selectedVehicle.id,
        status,
        is_emergency: isEmergency,
        lat: location.lat,
        lng: location.lng,
        updated_at: now,
        updated_by: profileId
      }).then();
    }
  }, [location, selectedVehicle, profileId, status, isEmergency]);

  const toggleEmergency = () => {
    if (skipNextUpdate.current) return;
    const next = !isEmergency;
    setIsEmergency(next);
    if (next && location && selectedVehicle && profileId) {
      supabase.from('gd_vehicle_status').upsert({ vehicle_id: selectedVehicle.id, status, lat: location.lat, lng: location.lng, is_emergency: true, updated_at: new Date().toISOString(), updated_by: profileId }).then();
    }
  };

  const handleLogout = async () => {
    // 1. Limpiar vehículo seleccionado de la memoria local
    localStorage.removeItem('geo_dispatch_vehicle');
    // 2. Cerrar sesión en Supabase
    await supabase.auth.signOut();
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
        <button onClick={handleLogout} className="p-3 text-gray-400 hover:text-rose-500 transition-all flex flex-col items-center gap-1">
          <LogOut className="w-6 h-6" />
          <span className="text-[8px] font-bold uppercase">Salir</span>
        </button>
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
            <button onClick={handleReleaseVehicle} className="px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold uppercase hover:bg-rose-100 transition-colors">Liberar Vehículo</button>
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
role:gd_roles(name)').eq('id', userId).single();
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
