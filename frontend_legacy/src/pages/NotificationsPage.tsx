import React, { useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare, CheckCircle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getMyNotifications();
      setNotifications(data);
    } catch (error) {
      showToast('Error al cargar notificaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
      );
      showToast('Notificación marcada como leída', 'success');
    } catch (error) {
      showToast('Error al marcar como leída', 'error');
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      case 'SMS': return <MessageSquare className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
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
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-gray-500 mt-1">Centro de alertas y comunicaciones</p>
        </div>
        <Badge variant="primary" size="md">
          <Bell className="w-4 h-4 mr-1" />
          {notifications.filter((n) => n.status !== 'READ').length} sin leer
        </Badge>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`transition-all ${notif.status !== 'READ' ? 'border-l-4 border-l-primary-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${notif.channel === 'EMAIL' ? 'bg-blue-100 text-blue-600' : notif.channel === 'SMS' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                    {getChannelIcon(notif.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">{notif.channel}</span>
                      {notif.status !== 'READ' && (
                        <Badge variant="primary" size="sm">Nueva</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-line">{notif.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(notif.createdAt)}</span>
                      {notif.alert?.student && (
                        <>
                          <span>•</span>
                          <span>{notif.alert.student.user?.firstName} {notif.alert.student.user?.lastName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {notif.status !== 'READ' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Marcar leída
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <Card className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Sin notificaciones</h3>
            <p className="text-gray-500 mt-1">No tiene notificaciones en este momento</p>
          </Card>
        )}
      </div>
    </div>
  );
};
