import { Map as MapIcon, Settings, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  activeTab: 'map' | 'management';
  onTabChange: (tab: 'map' | 'management') => void;
}

export const AdminNavbar: React.FC<Props> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-50">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-blue-600 tracking-tighter">GeoDispatch</h1>
        <div className="flex gap-1">
          <button
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'map' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <MapIcon className="w-4 h-4" /> Mapa
          </button>
          <button
            onClick={() => onTabChange('management')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'management' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" /> Gestión
          </button>
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 hover:text-rose-500 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Salir
      </button>
    </nav>
  );
};
