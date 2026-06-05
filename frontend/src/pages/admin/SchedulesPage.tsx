import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Clock, Calendar, User, BookOpen } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { getDayName } from '../../utils';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const SchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  const [formData, setFormData] = useState({
    subjectId: '',
    teacherId: '',
    groupId: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    classroom: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schedulesData, , teachersData] = await Promise.all([
        api.getSchedules(),
        api.getUsers('TEACHER'),
        api.getUsers('TEACHER'),
        api.getUsers(), // We'll filter groups from users or create separate endpoint
      ]);
      // For demo, we'll use mock groups if API doesn't return them
      setSchedules(schedulesData);
      setSubjects([
        { id: 1, name: 'Matemáticas IV' },
        { id: 2, name: 'Física III' },
        { id: 3, name: 'Programación Web' },
        { id: 4, name: 'Base de Datos' },
        { id: 5, name: 'Inglés IV' },
      ]);
      setTeachers(teachersData);
      setGroups([
        { id: 1, name: '3A - Programación' },
        { id: 2, name: '3B - Programación' },
        { id: 3, name: '4A - Contabilidad' },
        { id: 4, name: '5A - Electrónica' },
        { id: 5, name: '6A - Mecatrónica' },
      ]);
    } catch (error) {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictWarning(null);

    try {
      const data = {
        ...formData,
        subjectId: parseInt(formData.subjectId),
        teacherId: parseInt(formData.teacherId),
        groupId: parseInt(formData.groupId),
      };

      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, data);
        showToast('Horario actualizado exitosamente', 'success');
      } else {
        await api.createSchedule(data);
        showToast('Horario creado exitosamente', 'success');
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Error al guardar horario';
      if (message.includes('CONFLICTO')) {
        setConflictWarning(message);
      }
      showToast(message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este horario?')) return;
    try {
      await api.deleteSchedule(id);
      showToast('Horario eliminado', 'success');
      loadData();
    } catch (error) {
      showToast('Error al eliminar horario', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      subjectId: '',
      teacherId: '',
      groupId: '',
      dayOfWeek: '',
      startTime: '',
      endTime: '',
      classroom: '',
    });
    setEditingSchedule(null);
    setConflictWarning(null);
  };

  const openEditModal = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      subjectId: schedule.subjectId?.toString() || '',
      teacherId: schedule.teacherId?.toString() || '',
      groupId: schedule.groupId?.toString() || '',
      dayOfWeek: schedule.dayOfWeek || '',
      startTime: schedule.startTime || '',
      endTime: schedule.endTime || '',
      classroom: schedule.classroom || '',
    });
    setIsModalOpen(true);
  };

  const groupedByDay = DAYS.map((day) => ({
    day,
    dayName: getDayName(day),
    schedules: schedules.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Horarios</h1>
          <p className="text-gray-500 mt-1">Administrar horarios de clases</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Horario
        </Button>
      </div>

      {/* Tabla de horarios por día */}
      <div className="space-y-6">
        {groupedByDay.map(({ day, dayName, schedules: daySchedules }) => (
          <Card key={day}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">{dayName}</h2>
              <Badge variant="default" size="sm">{daySchedules.length} clases</Badge>
            </div>
            {daySchedules.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Hora</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Materia</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Docente</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Grupo</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Aula</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySchedules.map((schedule) => (
                      <tr key={schedule.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{schedule.startTime} - {schedule.endTime}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-medium">{schedule.subject?.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4 text-gray-400" />
                            {schedule.teacher?.user?.firstName} {schedule.teacher?.user?.lastName}
                          </div>
                        </td>
                        <td className="py-2 px-3">{schedule.group?.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                            {schedule.classroom || 'N/A'}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(schedule)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(schedule.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No hay clases programadas</p>
            )}
          </Card>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {conflictWarning && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{conflictWarning}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Materia"
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
              options={subjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
              required
            />
            <Select
              label="Docente"
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              options={teachers.map((t) => ({ value: t.teacherProfile?.id?.toString() || t.id.toString(), label: `${t.firstName} ${t.lastName}` }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Grupo"
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              options={groups.map((g) => ({ value: g.id.toString(), label: g.name }))}
              required
            />
            <Select
              label="Día de la semana"
              value={formData.dayOfWeek}
              onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
              options={DAYS.map((d) => ({ value: d, label: getDayName(d) }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Hora de inicio"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
            <Input
              label="Hora de fin"
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
          </div>

          <Input
            label="Aula (opcional)"
            value={formData.classroom}
            onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
            placeholder="Ej: A-101, LAB-1"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingSchedule ? 'Actualizar' : 'Crear'} Horario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
