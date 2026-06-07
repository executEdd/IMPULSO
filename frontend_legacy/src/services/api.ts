import axios, { AxiosInstance, AxiosError } from 'axios';
import type { AuthResponse, LoginCredentials, RegisterData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // No redirigir si el error viene del login
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        
        if (error.response?.status === 401 && !isLoginRequest) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      },
    );
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async register(data: RegisterData): Promise<{ message: string; user: any }> {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async getProfile(): Promise<any> {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  // Users
  async getUsers(role?: string): Promise<any[]> {
    const params = role ? { role } : {};
    const response = await this.client.get('/users', { params });
    return response.data;
  }

  async getUser(id: number): Promise<any> {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: any): Promise<any> {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async updateUser(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: number): Promise<any> {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  // Attendance
  async scanQr(qrToken: string, scheduleId: number): Promise<any> {
    const response = await this.client.post('/attendance/scan-qr', { qrToken, scheduleId });
    return response.data;
  }

  async markAbsent(studentId: number, scheduleId: number): Promise<any> {
    const response = await this.client.post(`/attendance/mark-absent/${studentId}/${scheduleId}`);
    return response.data;
  }

  async getAttendance(filters?: { studentId?: number; scheduleId?: number; date?: string }): Promise<any[]> {
    const params = filters || {};
    const response = await this.client.get('/attendance', { params });
    return response.data;
  }

  async getStudentAttendance(studentId: number): Promise<any[]> {
    const response = await this.client.get(`/attendance/student/${studentId}`);
    return response.data;
  }

  async getStudentAbsences(studentId: number): Promise<any> {
    const response = await this.client.get(`/attendance/student/${studentId}/absences`);
    return response.data;
  }

  async getRedSemaphoreStudents(): Promise<any[]> {
    const response = await this.client.get('/attendance/red-semaphore');
    return response.data;
  }

  // Schedules
  async getSchedules(): Promise<any[]> {
    const response = await this.client.get('/schedules');
    return response.data;
  }

  async getSchedule(id: number): Promise<any> {
    const response = await this.client.get(`/schedules/${id}`);
    return response.data;
  }

  async getTeacherSchedules(teacherId: number): Promise<any[]> {
    const response = await this.client.get(`/schedules/teacher/${teacherId}`);
    return response.data;
  }

  async getGroupSchedules(groupId: number): Promise<any[]> {
    const response = await this.client.get(`/schedules/group/${groupId}`);
    return response.data;
  }

  async createSchedule(data: any): Promise<any> {
    const response = await this.client.post('/schedules', data);
    return response.data;
  }

  async updateSchedule(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/schedules/${id}`, data);
    return response.data;
  }

  async deleteSchedule(id: number): Promise<any> {
    const response = await this.client.delete(`/schedules/${id}`);
    return response.data;
  }

  async checkScheduleConflicts(teacherId: number, groupId: number, dayOfWeek: string, startTime: string, endTime: string): Promise<any> {
    const response = await this.client.get('/schedules/check-conflicts', {
      params: { teacherId, groupId, dayOfWeek, startTime, endTime },
    });
    return response.data;
  }

  // Grades
  async getGrades(filters?: { studentId?: number; subjectId?: number; period?: string }): Promise<any[]> {
    const params = filters || {};
    const response = await this.client.get('/grades', { params });
    return response.data;
  }

  async getGrade(id: number): Promise<any> {
    const response = await this.client.get(`/grades/${id}`);
    return response.data;
  }

  async getStudentGrades(studentId: number): Promise<any[]> {
    const response = await this.client.get(`/grades/student/${studentId}`);
    return response.data;
  }

  async createGrade(data: any): Promise<any> {
    const response = await this.client.post('/grades', data);
    return response.data;
  }

  async updateGrade(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/grades/${id}`, data);
    return response.data;
  }

  async deleteGrade(id: number): Promise<any> {
    const response = await this.client.delete(`/grades/${id}`);
    return response.data;
  }

  async getGradeLogs(gradeId: number): Promise<any[]> {
    const response = await this.client.get(`/grades/logs/${gradeId}`);
    return response.data;
  }

  async getAllLogs(): Promise<any[]> {
    const response = await this.client.get('/grades/logs/all');
    return response.data;
  }

  // Notifications
  async getNotifications(): Promise<any[]> {
    const response = await this.client.get('/notifications');
    return response.data;
  }

  async getMyNotifications(): Promise<any[]> {
    const response = await this.client.get('/notifications/my-notifications');
    return response.data;
  }

  async getUnreadCount(): Promise<number> {
    const response = await this.client.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationRead(id: number): Promise<any> {
    const response = await this.client.put(`/notifications/${id}/read`);
    return response.data;
  }

  async sendManualNotification(data: { studentId: number; recipientType: string; channel: string; content: string }): Promise<any> {
    const response = await this.client.post('/notifications/send-manual', data);
    return response.data;
  }

  // QR
  async getMyQr(): Promise<any> {
    const response = await this.client.get('/qr/my-qr');
    return response.data;
  }

  async refreshMyQr(): Promise<any> {
    const response = await this.client.post('/qr/refresh');
    return response.data;
  }
}

export const api = new ApiService();
