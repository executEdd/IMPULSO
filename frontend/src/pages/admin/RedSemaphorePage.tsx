import React, { useEffect, useState } from 'react';
import { AlertTriangle, Mail, MessageSquare, User, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { formatDate, getAttendanceStatusColor } from '../../utils';

export const RedSemaphorePage: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [notifyContent, setNotifyContent] = useState('');
  const [notifyChannel, setNotifyChannel] = useState('EMAIL');
  const [sending, setSending] = useState(false);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    loadRedSemaphoreStudents();
  }, []);

  const loadRedSemaphoreStudents = async () => {
    try {
      const data = await api.getRedSemaphoreStudents();
      setStudents(data);
    } catch (error) {
      showToast('Error al cargar alumnos en semáforo rojo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedStudent || !notifyContent.trim()) return;
    setSending(true);
    try {
      await api.sendManualNotification({
        studentId: selectedStudent.id,
        recipientType: 'PARENT',
        channel: notifyChannel,
        content: notifyContent,
      });
      showToast('Notificación enviada exitosamente', 'success');
      setIsNotifyModalOpen(false);
      setNotifyContent('');
    } catch (error) {
      showToast('Error al enviar notificación', 'error');
    } finally {
      setSending(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Semáforo Rojo</h1>
          <p className="text-gray-500 mt-1">Alumnos con 3 o más faltas acumuladas</p>
        </div>
        <Badge variant="danger" size="md">
          <AlertTriangle className="w-4 h-4 mr-1" />
          {students.length} Alertas Activas
        </Badge>
      </div>

      {students.length === 0 ? (
        <Card className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">¡Excelente!</h3>
          <p className="text-gray-500 mt-1">No hay alumnos en semáforo rojo actualmente</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {students.map((student) => (
            <Card key={student.id} className="border-l-4 border-l-red-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold">
                    {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{student.user?.firstName} {student.user?.lastName}</h3>
                    <p className="text-sm text-gray-500">{student.enrollmentId} • {student.group?.name}</p>
                  </div>
                </div>
                <Badge variant="danger">{student.attendances?.length || 0} Faltas</Badge>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-gray-700">Historial de faltas recientes:</p>
                {student.attendances?.slice(0, 5).map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-red-500" />
                      <span className="text-gray-700">{formatDate(att.date)}</span>
                    </div>
                    <span className="text-red-600 font-medium">{att.schedule?.subject?.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  <User className="w-4 h-4 inline mr-1" />
                  Tutor: {student.parent?.user?.firstName} {student.parent?.user?.lastName}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedStudent(student);
                      setNotifyChannel('EMAIL');
                      setNotifyContent(`Estimado padre/tutor de ${student.user?.firstName} ${student.user?.lastName}:

Le recordamos que su hijo(a) se encuentra en Semáforo Rojo por acumulación de faltas. Por favor, comuníquese con la Subdirección Académica.`);
                      setIsNotifyModalOpen(true);
                    }}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedStudent(student);
                      setNotifyChannel('SMS');
                      setNotifyContent(`CBTIS 61: Su hijo(a) ${student.user?.firstName} está en Semáforo Rojo. Contacte Subdirección.`);
                      setIsNotifyModalOpen(true);
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    SMS
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isNotifyModalOpen}
        onClose={() => setIsNotifyModalOpen(false)}
        title={`Enviar notificación ${notifyChannel === 'EMAIL' ? 'por Correo' : 'por SMS'}`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destinatario</label>
            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded-lg">
              {selectedStudent?.parent?.user?.firstName} {selectedStudent?.parent?.user?.lastName} 
              (Tutor de {selectedStudent?.user?.firstName} {selectedStudent?.user?.lastName})
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
            <textarea
              value={notifyContent}
              onChange={(e) => setNotifyContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsNotifyModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendNotification} isLoading={sending}>
              Enviar {notifyChannel === 'EMAIL' ? 'Correo' : 'SMS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
