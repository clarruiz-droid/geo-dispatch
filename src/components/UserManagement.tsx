import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { User, Shield, Loader2, RefreshCw, Pencil, Trash2, X, Check, IdCard, Plus, Mail, Key } from 'lucide-react';

export const UserManagement = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    dni: '',
    email: '',
    password: '',
    role_id: 2 // Por defecto Chofer
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rData } = await supabase.from('gd_roles').select('*');
    if (rData) setRoles(rData);

    const { data: pData } = await supabase
      .from('gd_profiles')
      .select('*, role:gd_roles(name)')
      .is('deleted_at', null)
      .order('full_name', { ascending: true });
    
    if (pData) setProfiles(pData);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingProfile(null);
    setFormData({
      full_name: '',
      dni: '',
      email: '',
      password: '',
      role_id: roles.find(r => r.name === 'driver')?.id || 2
    });
    setIsModalOpen(true);
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      full_name: profile.full_name || '',
      dni: profile.dni || '',
      email: profile.email || '',
      password: '', // No se edita la contraseña aquí por seguridad
      role_id: profile.role_id
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      if (editingProfile) {
        // --- ACTUALIZAR USUARIO EXISTENTE ---
        const { error } = await supabase
          .from('gd_profiles')
          .update({
            full_name: formData.full_name,
            dni: formData.dni,
            role_id: formData.role_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProfile.id);
        
        if (error) throw error;
      } else {
        // --- CREAR NUEVO USUARIO ---
        // 1. Registrar en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name
            }
          }
        });

        if (authError) throw authError;

        // 2. El trigger 'handle_new_user' ya creó el perfil, ahora lo actualizamos con DNI y Rol
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('gd_profiles')
            .update({
              dni: formData.dni,
              role_id: formData.role_id,
              full_name: formData.full_name // Aseguramos que se guarde
            })
            .eq('id', authData.user.id);
          
          if (profileError) throw profileError;
          alert('Usuario creado con éxito. Si tienes habilitada la confirmación por email, el usuario deberá verificar su cuenta.');
        }
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al procesar la solicitud');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    
    const { error } = await supabase
      .from('gd_profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) fetchData();
    else alert(error.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">Gestiona roles y accesos del personal</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-xl border border-gray-100"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5" /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuario</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">DNI</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Email</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Rol</th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400 italic">No hay perfiles registrados</td>
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
                    <td className="p-4 text-gray-500 text-sm font-mono">{p.dni || '-'}</td>
                    <td className="p-4 text-gray-500 text-sm">{p.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        p.role?.name === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {p.role?.name}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Alta/Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-black text-gray-900">
                {editingProfile ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Solo para NUEVOS usuarios */}
              {!editingProfile && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email (Acceso)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        required
                        placeholder="usuario@ejemplo.com"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contraseña Temporal</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">DNI</label>
                <div className="relative">
                  <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Sin puntos ni espacios"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rol de Sistema</label>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, role_id: r.id })}
                      className={`p-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        formData.role_id === r.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {editingProfile ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
