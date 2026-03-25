import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import React from 'react';
import L from 'leaflet';
import type { VehicleLocationStatus, Vehicle } from '../types';

interface ExtendedStatus extends VehicleLocationStatus {
  history: [number, number][];
  is_alert?: boolean;
  is_offline?: boolean;
}

interface Props {
  vehicles: Vehicle[];
  statuses: ExtendedStatus[];
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

const createCustomIcon = (status: string, patente: string, isAlert?: boolean, isOffline?: boolean) => {
  const color = isOffline ? '#94a3b8' : (isAlert ? '#e11d48' : getStatusColor(status));
  const opacity = isOffline ? '0.6' : '1';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <style>
        @keyframes custom-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(225, 29, 72, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
        }
        .pulse-alert {
          animation: custom-pulse 1.5s infinite;
          border-color: #fb7185 !important;
        }
      </style>
      <div class="${isAlert && !isOffline ? 'pulse-alert' : ''}" style="background-color: ${color}; opacity: ${opacity}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; transition: all 0.3s;">
        ${patente.slice(-3)}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

export const DispatchMap: React.FC<Props> = ({ vehicles, statuses }) => {
  const center: [number, number] = [-34.6037, -58.3816];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
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
                icon={createCustomIcon(status.status, vehicle.patente, status.is_alert, status.is_offline)}
              >
                <Popup>
                  <div className="p-1">
                    <p className="font-bold text-lg">{vehicle.patente}</p>
                    {status.is_offline && (
                      <p className="text-gray-500 font-bold text-[10px] uppercase">📡 SIN SEÑAL (+1 min)</p>
                    )}
                    {status.is_alert && !status.is_offline && (
                      <p className="text-rose-600 font-bold text-[10px] animate-bounce uppercase">⚠️ Demora Excesiva</p>
                    )}
                    <p className="text-gray-600 italic text-xs">{vehicle.modelo}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(status.status, status.is_offline) }} />
                      <span className="capitalize font-medium text-sm">{status.status}</span>
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
