import React, { useEffect, useState } from 'react';
import {
  Users, GraduationCap, Bell,
  TrendingUp, AlertTriangle, BookOpen, Clock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { getSemaphoreColor, formatDate } from '../utils';

interface DashboardStats {
  totalUsers?: number;
  totalStudents?: number;
  totalTeachers?: number;
  redSemaphoreCount?: number;
  todayAttendance?: number;
  mySchedules?: any[];
  myGrades?: any[];
  myChildren?: any[];
  notifications?: any[];
}

export const DashboardPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const data: DashboardStats = {};

      if (hasRole(['ADMIN'])) {
        const users = await api.getUsers();
        const redStudents = await api.getRedSemaphoreStudents();
        data.totalUsers = users.length;
        data.totalStudents = users.filter((u: any) => u.role === 'STUDENT').length;
        data.totalTeachers = users.filter((u: any) => u.role === 'TEACHER').length;
        data.redSemaphoreCount = redStudents.length;
      }

      if (hasRole(['TEACHER']) && user?.teacherProfile?.id) {
        const schedules = await api.getTeacherSchedules(user.teacherProfile.id);
        data.mySchedules = schedules;
      }

      if (hasRole(['STUDENT']) && user?.studentProfile?.id) {
        const [schedules, grades, attendance] = await Promise.all([
          api.getGroupSchedules(user.studentProfile.groupId),
          api.getStudentGrades(user.studentProfile.id),
          api.getStudentAbsences(user.studentProfile.id),
        ]);
        data.mySchedules = schedules;
        data.myGrades = grades;
        data.todayAttendance = attendance.attendanceRate;
      }

      if (hasRole(['PARENT']) && user?.parentProfile?.id) {
        const parentData = await api.getUser(user.id);
        data.myChildren = parentData.parentProfile?.children || [];
      }

      const notifications = await api.getMyNotifications();
      data.notifications = notifications.slice(0, 5);

      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTodaySchedules = () => {
    const today = new Date().getDay();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayName = dayNames[today];
    return stats.mySchedules?.filter((s: any) => s.dayOfWeek === todayName) || [];
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bienvenido, {user?.firstName} {user?.lastName}</p>
      </div>

      {/* Stats Cards - Admin */}
      {hasRole(['ADMIN']) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm">Total Usuarios</p>
                <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-primary-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Alumnos</p>
                <p className="text-3xl font-bold mt-1">{stats.totalStudents}</p>
              </div>
              <GraduationCap className="w-8 h-8 text-blue-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Docentes</p>
                <p className="text-3xl font-bold mt-1">{stats.totalTeachers}</p>
              </div>
              <BookOpen className="w-8 h-8 text-emerald-200" />
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Semáforo Rojo</p>
                <p className="text-3xl font-bold mt-1">{stats.redSemaphoreCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-200" />
            </div>
          </Card>
        </div>
      )}

      {/* Student Semaphore */}
      {hasRole(['STUDENT']) && user?.studentProfile && (
        <Card className={`border-l-4 ${getSemaphoreColor(user.studentProfile.semaphore).bg.replace('bg-', 'border-')}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getSemaphoreColor(user.studentProfile.semaphore).bg}`}>
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado Académico</p>
                <p className="text-lg font-semibold text-gray-900">
                  Semáforo {getSemaphoreColor(user.studentProfile.semaphore).label}
                </p>
              </div>
            </div>
            <Badge variant={user.studentProfile.semaphore === 'RED' ? 'danger' : user.studentProfile.semaphore === 'YELLOW' ? 'warning' : 'success'}>
              {getSemaphoreColor(user.studentProfile.semaphore).label}
            </Badge>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horario de hoy */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Horario de Hoy</h2>
          </div>
          <div className="space-y-3">
            {getTodaySchedules().length > 0 ? (
              getTodaySchedules().map((schedule: any) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{schedule.subject?.name}</p>
                    <p className="text-sm text-gray-500">
                      {schedule.teacher?.user?.firstName} {schedule.teacher?.user?.lastName} • Aula {schedule.classroom}
                    </p>
                  </div>
                  <Badge variant="primary">{schedule.startTime} - {schedule.endTime}</Badge>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No hay clases programadas para hoy</p>
            )}
          </div>
        </Card>

        {/* Notificaciones recientes */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notificaciones Recientes</h2>
          </div>
          <div className="space-y-3">
            {stats.notifications && stats.notifications.length > 0 ? (
              stats.notifications.map((notif: any) => (
                <div key={notif.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.status === 'READ' ? 'bg-gray-300' : 'bg-primary-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{notif.content}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(notif.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No hay notificaciones recientes</p>
            )}
          </div>
        </Card>
      </div>

      {/* Children info for parents */}
      {hasRole(['PARENT']) && stats.myChildren && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Mis Tutorados</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.myChildren.map((child: any) => (
              <div key={child.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                  {child.user?.firstName?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{child.user?.firstName} {child.user?.lastName}</p>
                  <p className="text-sm text-gray-500">{child.group?.name} • {child.enrollmentId}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${getSemaphoreColor(child.semaphore).bg}`} />
                    <span className="text-xs text-gray-500">Semáforo {getSemaphoreColor(child.semaphore).label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
