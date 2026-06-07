import React, { useEffect, useState } from 'react';
import { RefreshCw, Clock, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../components/common/Toast';

export const MyQrPage: React.FC = () => {
  const { user } = useAuth();
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const { showToast, ToastContainer } = useToast();

  const loadQr = async () => {
    try {
      const data = await api.getMyQr();
      setQrData(data);
      if (data.expiresAt) {
        const expires = new Date(data.expiresAt).getTime();
        const now = Date.now();
        setTimeLeft(Math.max(0, Math.floor((expires - now) / 1000)));
      }
    } catch (error) {
      showToast('Error al cargar QR', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshQr = async () => {
    setRefreshing(true);
    try {
      const data = await api.refreshMyQr();
      setQrData(data);
      setTimeLeft(30);
      showToast('Código QR regenerado', 'success');
    } catch (error) {
      showToast('Error al regenerar QR', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQr();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refreshQr();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <ToastContainer />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Mi Credencial Digital</h1>
        <p className="text-gray-500 mt-1">Escanea este código QR para registrar tu asistencia</p>
      </div>

      <Card className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Código QR de Asistencia</h2>
        </div>

        {qrData?.qrImage ? (
          <div className="space-y-4">
            <div className="relative inline-block">
              <img
                src={qrData.qrImage}
                alt="Código QR"
                className="w-64 h-64 mx-auto rounded-xl shadow-lg"
              />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                <Badge variant={timeLeft <= 10 ? 'danger' : timeLeft <= 20 ? 'warning' : 'success'}>
                  <Clock className="w-3 h-3 mr-1" />
                  Expira en {timeLeft}s
                </Badge>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <p className="text-sm text-gray-500">Token: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{qrData.qrToken?.slice(0, 16)}...</code></p>
              <Button
                onClick={refreshQr}
                isLoading={refreshing}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerar Ahora
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <p className="text-gray-500">No hay código QR activo</p>
            <Button onClick={refreshQr} className="mt-3" size="sm">
              Generar QR
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Información del Alumno</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Nombre:</span>
            <span className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Matrícula:</span>
            <span className="font-medium text-gray-900">{user?.studentProfile?.enrollmentId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Grupo:</span>
            <span className="font-medium text-gray-900">{user?.studentProfile?.group?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Semáforo:</span>
            <Badge variant={user?.studentProfile?.semaphore === 'RED' ? 'danger' : user?.studentProfile?.semaphore === 'YELLOW' ? 'warning' : 'success'}>
              {user?.studentProfile?.semaphore === 'RED' ? 'Rojo' : user?.studentProfile?.semaphore === 'YELLOW' ? 'Amarillo' : 'Verde'}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="text-center text-xs text-gray-400">
        <p>Este código QR se regenera automáticamente cada 30 segundos por seguridad.</p>
        <p className="mt-1">No comparta su código QR con otras personas.</p>
      </div>
    </div>
  );
};
