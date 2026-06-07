import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../components/common/Toast';
import { getDayName } from '../../utils';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const StudentSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    const today = new Date().getDay();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    setSelectedDay(dayNames[today] || 'MONDAY');

    if (user?.studentProfile?.groupId) {
      loadSchedules();
    }
  }, [user]);

  const loadSchedules = async () => {
    try {
      const data = await api.getGroupSchedules(user!.studentProfile!.groupId);
      setSchedules(data);
    } catch (error) {
      showToast('Error al cargar horario', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSchedulesForDay = (day: string) => {
    return schedules
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const isCurrentClass = (schedule: any) => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = dayNames[now.getDay()];
    return currentDay === schedule.dayOfWeek && currentTime >= schedule.startTime && currentTime <= schedule.endTime;
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
        <h1 className="text-2xl font-bold text-gray-900">Mi Horario</h1>
        <p className="text-gray-500 mt-1">{user?.studentProfile?.group?.name}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDay === day
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {getDayName(day)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {getSchedulesForDay(selectedDay).length > 0 ? (
          getSchedulesForDay(selectedDay).map((schedule) => {
            const current = isCurrentClass(schedule);
            return (
              <Card
                key={schedule.id}
                className={`transition-all ${current ? 'ring-2 ring-primary-500 bg-primary-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-primary-600" />
                      <h3 className="font-semibold text-gray-900">{schedule.subject?.name}</h3>
                      {current && (
                        <Badge variant="primary" size="sm">Clase Actual</Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{schedule.startTime} - {schedule.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{schedule.teacher?.user?.firstName} {schedule.teacher?.user?.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>Aula {schedule.classroom || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`w-3 h-3 rounded-full ${current ? 'bg-primary-500 animate-pulse' : 'bg-gray-300'}`} />
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay clases programadas para {getDayName(selectedDay)}</p>
          </Card>
        )}
      </div>
    </div>
  );
};
