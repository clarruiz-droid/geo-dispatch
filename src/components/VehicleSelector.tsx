import React from 'react';
import { Truck } from 'lucide-react';
import type { Vehicle } from '../types';

interface Props {
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
  selectedId?: string;
}

export const VehicleSelector: React.FC<Props> = ({ vehicles, onSelect, selectedId }) => {
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
        <Truck className="w-5 h-5 text-blue-500" />
        Seleccionar Vehículo
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              selectedId === v.id
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div>
              <p className="font-bold text-gray-900">{v.patente}</p>
              <p className="text-sm text-gray-500">{v.modelo}</p>
            </div>
            {selectedId === v.id && (
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
