import React, { useEffect, useState } from 'react';
import { Users, AlertTriangle, Bell, Calendar, GraduationCap } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../components/common/Toast';
import { getSemaphoreColor, getAttendanceStatusColor, formatDate } from '../../utils';

export const ParentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const parentData = await api.getUser(user!.id);
      const childrenData = parentData.parentProfile?.children || [];

      // Cargar detalles de cada hijo
      const childrenWithDetails = await Promise.all(
        childrenData.map(async (child: any) => {
          try {
            const [grades, attendance, attendanceRecords] = await Promise.all([
              api.getStudentGrades(child.id),
              api.getStudentAbsences(child.id),
              api.getStudentAttendance(child.id),
            ]);
            return { ...child, grades, attendance, attendanceRecords };
          } catch {
            return child;
          }
        })
      );

      setChildren(childrenWithDetails);

      const notifs = await api.getMyNotifications();
      setNotifications(notifs.slice(0, 5));
    } catch (error) {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel del Padre/Tutor</h1>
        <p className="text-gray-500 mt-1">Seguimiento académico de sus tutorados</p>
      </div>

      {/* Resumen de hijos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children.map((child) => {
          const semaphore = getSemaphoreColor(child.semaphore);
          return (
            <Card key={child.id} className={`border-l-4 ${semaphore.bg.replace('bg-', 'border-')}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${semaphore.bg}`}>
                  {child.user?.firstName?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{child.user?.firstName} {child.user?.lastName}</h3>
                  <p className="text-xs text-gray-500">{child.enrollmentId} • {child.group?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Promedio</p>
                  <p className="font-bold text-lg text-gray-900">
                    {child.grades?.length > 0
                      ? (child.grades.reduce((acc: number, g: any) => acc + (g.finalGrade || 0), 0) / child.grades.length).toFixed(1)
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Asistencia</p>
                  <p className="font-bold text-lg text-gray-900">{child.attendance?.attendanceRate || '0'}%</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${semaphore.bg}`} />
                <span className="text-xs text-gray-600">Semáforo {semaphore.label}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detalle por hijo */}
      {children.map((child) => (
        <Card key={`detail-${child.id}`}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {child.user?.firstName} {child.user?.lastName} - Detalle
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calificaciones */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Calificaciones
              </h3>
              {child.grades?.length > 0 ? (
                <div className="space-y-2">
                  {child.grades.map((grade: any) => (
                    <div key={grade.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">{grade.subject?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{grade.finalGrade ?? '-'}</span>
                        <Badge variant={grade.status === 'EXCELLENT' ? 'success' : grade.status === 'IRREGULAR' ? 'danger' : 'default'} size="sm">
                          {grade.status === 'EXCELLENT' ? 'Excelente' : grade.status === 'IRREGULAR' ? 'Irregular' : 'Regular'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay calificaciones registradas</p>
              )}
            </div>

            {/* Asistencias recientes */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Asistencias Recientes
              </h3>
              {child.attendanceRecords?.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {child.attendanceRecords.slice(0, 10).map((att: any) => {
                    const status = getAttendanceStatusColor(att.status);
                    return (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm text-gray-700">{att.schedule?.subject?.name}</span>
                          <p className="text-xs text-gray-500">{formatDate(att.date)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay registros de asistencia</p>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Notificaciones */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Alertas Recibidas</h2>
        </div>
        <div className="space-y-3">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{notif.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(notif.createdAt)} • {notif.channel}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No hay alertas recientes</p>
          )}
        </div>
      </Card>
    </div>
  );
};
