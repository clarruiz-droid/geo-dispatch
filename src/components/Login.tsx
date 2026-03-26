import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Truck, Lock, Mail, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState(''); // Email o DNI
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let emailToAuth = identifier.trim();

    // Lógica para detectar si es un DNI (solo números)
    const isDni = /^\d+$/.test(emailToAuth);

    if (isDni) {
      try {
        // Buscamos el perfil que coincida con ese DNI
        const { data, error: profileError } = await supabase
          .from('gd_profiles')
          .select('email')
          .eq('dni', emailToAuth)
          .single();

        if (profileError || !data) {
          throw new Error('No se encontró ningún usuario con ese DNI.');
        }
        emailToAuth = data.email;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailToAuth,
      password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials' 
        ? 'Credenciales inválidas. Verifica tus datos.' 
        : authError.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">GeoDispatch</h1>
          <p className="text-gray-500 text-sm">Ingresa a tu cuenta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg flex items-center gap-2 text-left">
              <Lock className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block text-left">Email o DNI</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="tu@email.com o DNI"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block text-left">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col items-center gap-2">
          <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            v0.4.6
          </p>
          <p className="text-center text-[10px] text-gray-300 italic">
            Si no tienes cuenta, contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
};
