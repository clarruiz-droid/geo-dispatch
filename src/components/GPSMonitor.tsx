import React from 'react';
import { Navigation, MapPin, AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';

interface Props {
  location: { lat: number; lng: number; accuracy?: number } | null;
  error: string | null;
  isTracking: boolean;
  pendingCount?: number;
}

export const GPSMonitor: React.FC<Props> = ({ location, error, isTracking, pendingCount = 0 }) => {
  const isOnline = navigator.onLine;

  return (
    <div className={`p-4 rounded-xl shadow-sm border ${
      isTracking ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Navigation className={`w-4 h-4 ${isTracking ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
          Estado del GPS
        </h3>
        <div className="flex gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
              <CloudOff className="w-3 h-3" /> OFFLINE
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            isTracking ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-600'
          }`}>
            {isTracking ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="mb-3 flex items-center gap-2 text-blue-700 text-[10px] font-bold bg-blue-50 p-2 rounded-lg animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {pendingCount} puntos guardados esperando conexión...
        </div>
      )}

      {error ? (
        <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-2 rounded-lg">
          <AlertTriangle className="w-4 h-4" />
          <span>Error: {error}</span>
        </div>
      ) : location ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-mono">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </span>
          </div>
          {location.accuracy && (
            <p className="text-xs text-gray-500 ml-6">
              Precisión: ±{Math.round(location.accuracy)} metros
            </p>
          )}
        </div>
      ) : isTracking ? (
        <p className="text-sm text-gray-500 italic">Buscando señal GPS...</p>
      ) : (
        <p className="text-sm text-gray-500">El seguimiento se activará en estado Operativo o Demora.</p>
      )}
    </div>
  );
};
