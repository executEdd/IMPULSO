import React, { useEffect, useState } from 'react';
import { Edit2, Save, X, GraduationCap, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import { getGradeStatusColor } from '../utils';

export const GradesPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2024-2025');
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [editForm, setEditForm] = useState({ partial1: '', partial2: '', partial3: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    loadData();
  }, [user, selectedPeriod]);

  const loadData = async () => {
    try {
      let gradesData: any[] = [];

      if (hasRole(['ADMIN'])) {
        gradesData = await api.getGrades({ period: selectedPeriod });
        const users = await api.getUsers('STUDENT');
        setStudents(users);
      } else if (hasRole(['TEACHER']) && user?.teacherProfile?.id) {
        // Obtener materias del docente y sus calificaciones
        const teacherSubjects = await api.getSchedules(); // Simplificado
        gradesData = await api.getGrades({ period: selectedPeriod });
        // Filtrar por materias del docente
      } else if (hasRole(['STUDENT']) && user?.studentProfile?.id) {
        gradesData = await api.getStudentGrades(user.studentProfile.id);
      } else if (hasRole(['PARENT']) && user?.parentProfile?.id) {
        const parentData = await api.getUser(user.id);
        const childrenIds = parentData.parentProfile?.children?.map((c: any) => c.id) || [];
        const allGrades: any[] = [];
        for (const childId of childrenIds) {
          const childGrades = await api.getStudentGrades(childId);
          allGrades.push(...childGrades);
        }
        gradesData = allGrades;
      }

      setGrades(gradesData);
      setSubjects([
        { id: 1, name: 'Matemáticas IV' },
        { id: 2, name: 'Física III' },
        { id: 3, name: 'Programación Web' },
        { id: 4, name: 'Base de Datos' },
        { id: 5, name: 'Inglés IV' },
      ]);
    } catch (error) {
      showToast('Error al cargar calificaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (grade: any) => {
    setEditingGrade(grade);
    setEditForm({
      partial1: grade.partial1?.toString() || '',
      partial2: grade.partial2?.toString() || '',
      partial3: grade.partial3?.toString() || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingGrade) return;
    try {
      const data: any = {};
      if (editForm.partial1 !== '') data.partial1 = parseFloat(editForm.partial1);
      if (editForm.partial2 !== '') data.partial2 = parseFloat(editForm.partial2);
      if (editForm.partial3 !== '') data.partial3 = parseFloat(editForm.partial3);

      await api.updateGrade(editingGrade.id, data);
      showToast('Calificación actualizada exitosamente', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error al actualizar', 'error');
    }
  };

  const handleViewLogs = async (gradeId: number) => {
    try {
      const logsData = await api.getGradeLogs(gradeId);
      setLogs(logsData);
      setShowLogs(true);
    } catch (error) {
      showToast('Error al cargar logs', 'error');
    }
  };

  const filteredGrades = grades.filter((grade) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      grade.student?.user?.firstName?.toLowerCase().includes(searchLower) ||
      grade.student?.user?.lastName?.toLowerCase().includes(searchLower) ||
      grade.subject?.name?.toLowerCase().includes(searchLower) ||
      grade.student?.group?.name?.toLowerCase().includes(searchLower)
    );
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calificaciones</h1>
          <p className="text-gray-500 mt-1">Gestión de calificaciones por parcial</p>
        </div>
        {hasRole(['ADMIN', 'TEACHER']) && (
          <Button onClick={() => { setEditingGrade(null); setEditForm({ partial1: '', partial2: '', partial3: '' }); setIsModalOpen(true); }}>
            <GraduationCap className="w-4 h-4 mr-2" />
            Nueva Calificación
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar alumno, materia o grupo..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="2024-2025">Periodo 2024-2025</option>
          <option value="2023-2024">Periodo 2023-2024</option>
        </select>
      </div>

      {/* Tabla de calificaciones */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Alumno</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Grupo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Materia</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Parcial 1</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Parcial 2</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Parcial 3</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Final</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Estatus</th>
                {(hasRole(['ADMIN', 'TEACHER'])) && (
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredGrades.map((grade) => {
                const statusColor = getGradeStatusColor(grade.status);
                return (
                  <tr key={grade.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {grade.student?.user?.firstName} {grade.student?.user?.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{grade.student?.enrollmentId}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{grade.student?.group?.name}</td>
                    <td className="py-3 px-4 text-gray-600">{grade.subject?.name}</td>
                    <td className="py-3 px-4 text-center font-medium">{grade.partial1 ?? '-'}</td>
                    <td className="py-3 px-4 text-center font-medium">{grade.partial2 ?? '-'}</td>
                    <td className="py-3 px-4 text-center font-medium">{grade.partial3 ?? '-'}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{grade.finalGrade ?? '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                        {statusColor.label}
                      </span>
                    </td>
                    {(hasRole(['ADMIN', 'TEACHER'])) && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(grade)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar calificación"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {hasRole(['ADMIN']) && (
                            <button
                              onClick={() => handleViewLogs(grade.id)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Ver auditoría"
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredGrades.length === 0 && (
          <div className="text-center py-12">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No se encontraron calificaciones</p>
          </div>
        )}
      </Card>

      {/* Modal de edición */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGrade ? 'Editar Calificación' : 'Nueva Calificación'}
        size="md"
      >
        <div className="space-y-4">
          {editingGrade && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {editingGrade.student?.user?.firstName} {editingGrade.student?.user?.lastName}
              </p>
              <p className="text-xs text-gray-500">
                {editingGrade.subject?.name} • {editingGrade.student?.group?.name}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcial 1</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editForm.partial1}
                onChange={(e) => setEditForm({ ...editForm, partial1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcial 2</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editForm.partial2}
                onChange={(e) => setEditForm({ ...editForm, partial2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcial 3</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editForm.partial3}
                onChange={(e) => setEditForm({ ...editForm, partial3: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de logs */}
      <Modal
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
        title="Logs de Auditoría"
        size="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{log.action}</span>
                  <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('es-MX')}</span>
                </div>
                <p className="text-gray-600">
                  <strong>Campo:</strong> {log.field} • <strong>Usuario:</strong> {log.user?.firstName} {log.user?.lastName}
                </p>
                {log.oldValue && <p className="text-red-600 text-xs mt-1">Anterior: {log.oldValue}</p>}
                {log.newValue && <p className="text-green-600 text-xs">Nuevo: {log.newValue}</p>}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No hay registros de auditoría</p>
          )}
        </div>
      </Modal>
    </div>
  );
};
