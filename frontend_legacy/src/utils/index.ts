export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatTime = (timeString: string): string => {
  return timeString;
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getDayName = (day: string): string => {
  const days: Record<string, string> = {
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miércoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
  };
  return days[day] || day;
};

export const getSemaphoreColor = (status: string): { bg: string; text: string; label: string } => {
  switch (status) {
    case 'GREEN':
      return { bg: 'bg-green-500', text: 'text-green-700', label: 'Verde' };
    case 'YELLOW':
      return { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Amarillo' };
    case 'RED':
      return { bg: 'bg-red-500', text: 'text-red-700', label: 'Rojo' };
    default:
      return { bg: 'bg-gray-500', text: 'text-gray-700', label: 'Desconocido' };
  }
};

export const getGradeStatusColor = (status: string): { bg: string; text: string; label: string } => {
  switch (status) {
    case 'EXCELLENT':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Excelente' };
    case 'REGULAR':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Regular' };
    case 'IRREGULAR':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Irregular' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Desconocido' };
  }
};

export const getAttendanceStatusColor = (status: string): { bg: string; text: string; label: string } => {
  switch (status) {
    case 'PRESENT':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Asistencia' };
    case 'ABSENT':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Falta' };
    case 'LATE':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Retardo' };
    case 'JUSTIFIED':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Justificado' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Desconocido' };
  }
};

export const getPriorityColor = (priority: string): { bg: string; text: string } => {
  switch (priority) {
    case 'CRITICAL':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'HIGH':
      return { bg: 'bg-orange-100', text: 'text-orange-700' };
    case 'MEDIUM':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'LOW':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};

export const classNames = (...classes: (string | boolean | undefined)[]): string => {
  return classes.filter(Boolean).join(' ');
};
