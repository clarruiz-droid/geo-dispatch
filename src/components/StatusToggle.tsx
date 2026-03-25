import React from 'react';
import { Play, Clock, Coffee, Wrench } from 'lucide-react';
import type { VehicleStatus } from '../types';

interface Props {
  currentStatus: VehicleStatus;
  onChange: (status: VehicleStatus) => void;
  disabled?: boolean;
}

export const StatusToggle: React.FC<Props> = ({ currentStatus, onChange, disabled }) => {
  const options = [
    { id: 'operativo' as const, label: 'Operativo', icon: Play, color: 'bg-emerald-500', activeColor: 'ring-emerald-200' },
    { id: 'demora' as const, label: 'Demora', icon: Clock, color: 'bg-amber-500', activeColor: 'ring-amber-200' },
    { id: 'standby' as const, label: 'Standby', icon: Coffee, color: 'bg-slate-500', activeColor: 'ring-slate-200' },
    { id: 'mtto' as const, label: 'Mantenimiento', icon: Wrench, color: 'bg-rose-500', activeColor: 'ring-rose-200' },
  ];

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Estado del Vehículo</h2>
      <div className="grid grid-cols-2 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all ${
              currentStatus === opt.id
                ? `${opt.color} text-white ring-4 ${opt.activeColor} scale-95 shadow-lg shadow-${opt.color}/20`
                : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 grayscale' : ''}`}
          >
            <opt.icon className={`w-8 h-8 mb-2 ${currentStatus === opt.id ? 'text-white' : 'text-gray-400'}`} />
            <span className="font-bold text-sm tracking-wide uppercase">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
