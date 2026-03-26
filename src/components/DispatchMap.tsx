import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import React, { useEffect } from 'react';
import L from 'leaflet';
import type { VehicleLocationStatus, Vehicle } from '../types';

interface ExtendedStatus extends VehicleLocationStatus {
  history: [number, number][];
  is_alert?: boolean;
  is_offline?: boolean;
  profile?: {
    full_name: string;
  } | null;
}

interface Props {
  vehicles: Vehicle[];
  statuses: ExtendedStatus[];
  selectedVehicleId?: string | null;
}

// Componente para controlar el movimiento del mapa
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, 16, { animate: true });
    }
  }, [center, map]);
  
  return null;
}

const getStatusColor = (status: string, isOffline?: boolean) => {
  if (isOffline) return '#94a3b8'; // slate-400 (gris)
  switch (status) {
    case 'operativo': return '#10b981';
    case 'demora': return '#f59e0b';
    case 'mtto': return '#f43f5e';
    default: return '#64748b';
  }
};

const createCustomIcon = (status: string, patente: string, isAlert?: boolean, isOffline?: boolean, isEmergency?: boolean) => {
  const color = isEmergency ? '#e11d48' : (isOffline ? '#94a3b8' : (isAlert ? '#e11d48' : getStatusColor(status)));
  const opacity = isOffline ? '0.6' : '1';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <style>
        @keyframes custom-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
          70% { transform: scale(1.2); box-shadow: 0 0 0 20px rgba(225, 29, 72, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
        }
        .pulse-alert {
          animation: custom-pulse 1.5s infinite;
          border-color: #fb7185 !important;
        }
        .pulse-emergency {
          animation: custom-pulse 0.6s infinite;
          border-color: #ffffff !important;
          background-color: #e11d48 !important;
          z-index: 999;
        }
      </style>
      <div class="${isEmergency ? 'pulse-emergency' : (isAlert && !isOffline ? 'pulse-alert' : '')}" style="background-color: ${color}; opacity: ${opacity}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; transition: all 0.3s;">
        ${isEmergency ? 'SOS' : patente.slice(-3)}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

export const DispatchMap: React.FC<Props> = ({ vehicles, statuses, selectedVehicleId }) => {
  const center: [number, number] = [-34.6037, -58.3816];
  
  // Buscar la ubicación del vehículo seleccionado para centrar
  const selectedStatus = selectedVehicleId ? statuses.find(s => s.vehicle_id === selectedVehicleId) : null;
  const mapCenter: [number, number] | null = (selectedStatus?.lat && selectedStatus?.lng) 
    ? [selectedStatus.lat, selectedStatus.lng] 
    : null;

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Controlador de cámara */}
        <MapController center={mapCenter} />
        
        {statuses.map((status) => {
          const vehicle = vehicles.find(v => v.id === status.vehicle_id);
          if (!status.lat || !status.lng || !vehicle) return null;

          return (
            <React.Fragment key={status.vehicle_id}>
              {status.history.length > 1 && (
                <Polyline 
                  positions={status.history} 
                  pathOptions={{ 
                    color: getStatusColor(status.status, status.is_offline), 
                    weight: 3, 
                    opacity: status.is_offline ? 0.3 : 0.6,
                    dashArray: '5, 10'
                  }} 
                />
              )}
              
              <Marker 
                position={[status.lat, status.lng]}
                icon={createCustomIcon(status.status, vehicle.patente, status.is_alert, status.is_offline, status.is_emergency)}
              >
                <Popup>
                  <div className="p-1 min-w-[120px]">
                    {status.is_emergency && (
                      <div className="mb-2 p-2 bg-rose-600 text-white rounded-lg text-center animate-pulse">
                        <p className="font-black text-xs uppercase tracking-widest">🚨 EMERGENCIA 🚨</p>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Vehículo y Chofer</p>
                    <p className="font-bold text-lg leading-tight">{vehicle.patente}</p>
                    <p className="text-blue-600 font-bold text-sm mb-2">{status.profile?.full_name || 'Sin chofer asignado'}</p>
                    
                    <div className="space-y-1.5 border-t border-gray-100 pt-2 mt-1">
                      {status.is_offline && (
                        <p className="text-gray-500 font-bold text-[10px] uppercase flex items-center gap-1">📡 SIN SEÑAL (+1 min)</p>
                      )}
                      {status.is_alert && !status.is_offline && (
                        <p className="text-rose-600 font-bold text-[10px] animate-bounce uppercase flex items-center gap-1">⚠️ Demora Excesiva</p>
                      )}
                      <p className="text-gray-500 italic text-[11px]">{vehicle.modelo}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(status.status, status.is_offline) }} />
                        <span className="capitalize font-bold text-gray-700 text-xs">{status.status}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};
