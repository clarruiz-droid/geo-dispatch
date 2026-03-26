import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Truck, User, RefreshCw, Loader2, Calendar } from 'lucide-react';

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

export const StatusHistory = () => {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gd_status_history')
      .select(`
        id,
        status,
        changed_at,
        vehicle:gd_vehicles(patente, modelo),
        profile:gd_profiles!gd_status_history_profile_id_fkey(full_name)
      `)
      .order('changed_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching status history:', error);
    } else {
      setHistory(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 text-left">Historial de Estados</h2>
          <p className="text-sm text-gray-500 text-left">Registro de cambios y movimientos de la flota</p>
        </div>
        <button 
          onClick={fetchHistory}
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
  );
};
