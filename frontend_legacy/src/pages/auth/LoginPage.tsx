import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Por favor complete todos los campos', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Llamando a login...');
      await login(email, password);
      console.log('Login exitoso, redirigiendo...');
      showToast('¡Bienvenido al Sistema CBTIS 61!', 'success');
      navigate('/dashboard');
      console.log('Navegación ejecutada');
    } catch (error: any) {
      console.error('Error en el proceso de login:', error);
      const errorMessage = error.response?.data?.message || 'Error al iniciar sesión';
      showToast(typeof errorMessage === 'string' ? errorMessage : 'Error de autenticación', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <ToastContainer />
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">CBTIS 61</h1>
          <p className="text-primary-200 text-sm">Sistema de Gestión Académica</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@cbtis61.edu.mx"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Ingresar al Sistema
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3">Credenciales de prueba:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-medium text-gray-700">Admin</p>
                <p className="text-gray-500">subdirector@cbtis61.edu.mx</p>
                <p className="text-gray-400">admin123</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-medium text-gray-700">Docente</p>
                <p className="text-gray-500">juan.perez@cbtis61.edu.mx</p>
                <p className="text-gray-400">teacher123</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-medium text-gray-700">Alumno</p>
                <p className="text-gray-500">alumno1@cbtis61.edu.mx</p>
                <p className="text-gray-400">student123</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-medium text-gray-700">Padre</p>
                <p className="text-gray-500">padre1@email.com</p>
                <p className="text-gray-400">parent123</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          © 2024 CBTIS 61. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};
