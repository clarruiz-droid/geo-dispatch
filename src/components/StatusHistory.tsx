import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Truck, User, RefreshCw, Loader2, Calendar, Map } from 'lucide-react';
import type { Vehicle } from '../types';

interface StatusHistoryEntry {
  id: number;
  status: string;
  changed_at: string;
  vehicle: {
    patente: string;
    modelo: string;
  };
  profile: {
    full_name: string;
  } | null;
}

interface StatusHistoryProps {
  onFetchTrail: (vehicleId: string, startDate: string, endDate: string) => Promise<void>;
}

export const StatusHistory: React.FC<StatusHistoryProps> = ({ onFetchTrail }) => {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Estados para el nuevo buscador
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingTrail, setLoadingTrail] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Cargar vehículos para el selector
        const { data: vData } = await supabase.from('gd_vehicles').select('*').is('deleted_at', null).order('patente');
        if (vData) setVehicles(vData);

        // Cargar historial de estados
        const { data, error } = await supabase
          .from('gd_status_history')
          .select(`
            id, status, changed_at,
            vehicle:gd_vehicles(patente, modelo),
            profile:profile_id(full_name)
          `)
          .order('changed_at', { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        } else {
          setHistory(data as any);
        }
      } catch (err: any) {
        console.error('[StatusHistory] Error inesperado:', err);
        alert(`Error al cargar datos: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  const handleFetchTrail = async () => {
    if (!selectedVehicle || !startDate || !endDate) {
      alert('Por favor, seleccione un vehículo y un rango de fechas completo.');
      return;
    }
    setLoadingTrail(true);
    await onFetchTrail(selectedVehicle, startDate, endDate);
    setLoadingTrail(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operativo': return 'bg-emerald-100 text-emerald-700';
      case 'demora': return 'bg-amber-100 text-amber-700';
      case 'standby': return 'bg-slate-100 text-slate-700';
      case 'mtto': return 'bg-rose-100 text-rose-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-12">
      {/* SECCIÓN NUEVA: BÚSQUEDA DE RECORRIDO HISTÓRICO */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 text-left">Recorrido Histórico por Vehículo</h2>
        <p className="text-sm text-gray-500 text-left">Selecciona un vehículo y un rango de fechas para visualizar su trayecto en el mapa.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label htmlFor="vehicle-select" className="block text-xs font-bold text-gray-500 uppercase mb-2">Vehículo</label>
          <select 
            id="vehicle-select"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
          >
            <option value="">Seleccionar patente...</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.patente}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="start-date" className="block text-xs font-bold text-gray-500 uppercase mb-2">Desde</label>
          <input 
            type="datetime-local" 
            id="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold" 
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-xs font-bold text-gray-500 uppercase mb-2">Hasta</label>
          <input 
            type="datetime-local" 
            id="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
          />
        </div>
        <button
          onClick={handleFetchTrail}
          disabled={loadingTrail}
          className="md:col-span-4 w-full p-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:bg-blue-300"
        >
          {loadingTrail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Map className="w-5 h-5" />}
          Ver Recorrido en el Mapa
        </button>
      </div>

      {/* SECCIÓN ANTIGUA: HISTORIAL DE ESTADOS */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 text-left">Historial de Cambios de Estado</h2>
            <p className="text-sm text-gray-500 text-left">Últimos 100 cambios de estado de la flota.</p>
          </div>
          <button 
            onClick={() => { /* Lógica de fetchHistory ya está en useEffect */ }}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-xl border border-gray-100"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Fecha y Hora</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Vehículo</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Estado</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Chofer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-left">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-left">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400 italic text-left">No hay registros de cambios de estado</td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors text-left">
                      <td className="p-4 text-left">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium text-left">
                          <Calendar className="w-4 h-4 text-gray-400 text-left" />
                          {formatDate(entry.changed_at)}
                        </div>
                      </td>
                      <td className="p-4 text-left">
                        <div className="flex items-center gap-3 text-left">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 text-left">
                            <Truck className="w-4 h-4 text-left" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-gray-900 text-left">{entry.vehicle?.patente || 'S/P'}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase text-left">{entry.vehicle?.modelo || 'Desconocido'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-left">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(entry.status)} text-left`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-4 text-left text-left">
                        <div className="flex items-center gap-2 text-sm text-gray-600 text-left">
                          <User className="w-4 h-4 text-gray-400 text-left" />
                          {entry.profile?.full_name || 'Desconocido'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
