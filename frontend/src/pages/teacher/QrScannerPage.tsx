import React, { useState, useEffect, useRef } from 'react';
import { QrCode, CheckCircle, XCircle, Camera, Keyboard } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../components/common/Toast';
import { getAttendanceStatusColor } from '../../utils';

export const QrScannerPage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const { showToast, ToastContainer } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTeacherSchedules();
  }, [user]);

  const loadTeacherSchedules = async () => {
    if (!user?.teacherProfile?.id) return;
    try {
      const data = await api.getTeacherSchedules(user.teacherProfile.id);
      setSchedules(data);
      // Seleccionar automáticamente la clase actual si coincide con la hora
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const currentDay = dayNames[now.getDay()];

      const currentClass = data.find((s: any) => 
        s.dayOfWeek === currentDay && 
        currentTime >= s.startTime && 
        currentTime <= s.endTime
      );
      if (currentClass) setSelectedSchedule(currentClass);
    } catch (error) {
      showToast('Error al cargar horarios', 'error');
    }
  };

  const handleScan = async () => {
    if (!qrInput.trim() || !selectedSchedule) {
      showToast('Ingrese el código QR y seleccione un horario', 'warning');
      return;
    }

    setScanning(true);
    try {
      const result = await api.scanQr(qrInput.trim(), selectedSchedule.id);
      setScanResult({ success: true, data: result });
      setRecentScans((prev) => [result.attendance, ...prev].slice(0, 10));
      setQrInput('');
      showToast(result.message, 'success');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Error al escanear QR';
      setScanResult({ success: false, message });
      showToast(message, 'error');
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  };

  const handleMarkAbsent = async (studentId: number) => {
    if (!selectedSchedule) return;
    try {
      const result = await api.markAbsent(studentId, selectedSchedule.id);
      setRecentScans((prev) => [result.attendance, ...prev].slice(0, 10));
      showToast(result.message, 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error al marcar falta', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pase de Lista - QR Smart-Check</h1>
        <p className="text-gray-500 mt-1">Escanee el código QR del alumno para registrar asistencia</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de escaneo */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Clase</label>
                <select
                  value={selectedSchedule?.id || ''}
                  onChange={(e) => {
                    const schedule = schedules.find((s) => s.id === parseInt(e.target.value));
                    setSelectedSchedule(schedule || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar horario...</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.subject?.name} - {schedule.group?.name} ({schedule.startTime}-{schedule.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSchedule && (
                <div className="p-3 bg-primary-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary-900">{selectedSchedule.subject?.name}</p>
                      <p className="text-sm text-primary-700">{selectedSchedule.group?.name} • Aula {selectedSchedule.classroom}</p>
                    </div>
                    <Badge variant="primary">{selectedSchedule.startTime} - {selectedSchedule.endTime}</Badge>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Keyboard className="w-4 h-4 inline mr-1" />
                  Código QR del Alumno
                </label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escanee o ingrese el código QR..."
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <Button onClick={handleScan} isLoading={scanning} disabled={!selectedSchedule}>
                    <QrCode className="w-4 h-4 mr-2" />
                    Registrar
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Presione Enter para registrar rápidamente</p>
              </div>

              {/* Resultado del escaneo */}
              {scanResult && (
                <div className={`p-4 rounded-lg ${scanResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    {scanResult.success ? (
                      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`font-medium ${scanResult.success ? 'text-green-900' : 'text-red-900'}`}>
                        {scanResult.success ? '¡Asistencia Registrada!' : 'Error de Validación'}
                      </p>
                      {scanResult.success ? (
                        <div className="mt-2 text-sm text-green-700 space-y-1">
                          <p><strong>Alumno:</strong> {scanResult.data.attendance?.studentName}</p>
                          <p><strong>Grupo:</strong> {scanResult.data.attendance?.group}</p>
                          <p><strong>Materia:</strong> {scanResult.data.attendance?.subject}</p>
                          <p><strong>Hora:</strong> {scanResult.data.attendance?.time}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-red-700 mt-1">{scanResult.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Registros recientes */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Registros Recientes</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentScans.length > 0 ? (
                recentScans.map((scan, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${scan.status === 'PRESENT' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{scan.studentName || `${scan.student?.user?.firstName} ${scan.student?.user?.lastName}`}</p>
                        <p className="text-xs text-gray-500">{scan.group || scan.student?.group?.name}</p>
                      </div>
                    </div>
                    <Badge variant={scan.status === 'PRESENT' ? 'success' : 'danger'}>
                      {scan.status === 'PRESENT' ? 'Asistencia' : 'Falta'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No hay registros recientes</p>
              )}
            </div>
          </Card>
        </div>

        {/* Panel lateral - Lista de alumnos del grupo */}
        <div>
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alumnos del Grupo</h2>
            {selectedSchedule ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">{selectedSchedule.group?.name}</p>
                {/* Aquí se cargarían los alumnos del grupo */}
                <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-gray-600">Lista de alumnos...</span>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  onClick={() => {/* Marcar falta masiva */}}
                >
                  Marcar Falta Masiva
                </Button>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Seleccione una clase</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
