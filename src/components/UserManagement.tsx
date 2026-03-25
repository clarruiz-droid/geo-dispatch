import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { User, Shield, Loader2, RefreshCw } from 'lucide-react';

export const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Cargar Roles
    const { data: rData } = await supabase.from('gd_roles').select('*');
    if (rData) setRoles(rData);

    // 2. Cargar Perfiles con sus roles
    const { data: pData } = await supabase
      .from('gd_profiles')
      .select('*, role:gd_roles(name)')
      .is('deleted_at', null)
      .order('full_name', { ascending: true });
    
    if (pData) setProfiles(pData);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRoleId: number) => {
    setUpdatingId(userId);
    const { error } = await supabase
      .from('gd_profiles')
      .update({ role_id: newRoleId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      // Actualizar localmente para no recargar todo
      setProfiles(prev => prev.map(p => 
        p.id === userId ? { ...p, role_id: newRoleId, role: { name: roles.find(r => r.id === newRoleId)?.name || '' } } : p
      ));
    } else {
      alert(error.message);
    }
    setUpdatingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">Gestiona roles y accesos del personal</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          title="Refrescar lista"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuario</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Email</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-gray-400 italic">No hay perfiles registrados</td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <User className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-gray-900">{p.full_name || 'Sin Nombre'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 text-sm">{p.email}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {updatingId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        ) : (
                          <Shield className={`w-4 h-4 ${p.role?.name === 'admin' ? 'text-blue-500' : 'text-gray-400'}`} />
                        )}
                        <select
                          className="bg-transparent font-bold text-sm text-gray-700 outline-none cursor-pointer focus:text-blue-600 transition-colors disabled:opacity-50"
                          value={p.role_id}
                          disabled={updatingId === p.id}
                          onChange={(e) => handleRoleChange(p.id, parseInt(e.target.value))}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                            </option>
                          ))}
                        </select>
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
