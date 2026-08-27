import {
  Component, inject, signal, OnInit, AfterViewInit,
  ViewChild, ElementRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

declare var Chart: any;

import { API } from '../../core/config/api.config';

interface KPI {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend: number;
  trendLabel: string;
}

interface ActivityItem {
  icon: string;
  iconColor: string;
  text: string;
  time: string;
  initials: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  auth = inject(AuthService);
  http = inject(HttpClient);

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  chartReady = false;
  pendingChartData: number[] | null = null;

  today = new Date();

  kpis = signal<KPI[]>([
    { label: 'Total alumnos',      value: '—', icon: 'fa-user-graduate',         color: '#3B82F6', trend: 0,    trendLabel: 'este período' },
    { label: 'Asistencia general', value: '—', icon: 'fa-circle-check',           color: '#10B981', trend: 2.3,  trendLabel: 'vs semana ant.' },
    { label: 'Promedio académico', value: '—', icon: 'fa-star',                   color: '#F59E0B', trend: -0.4, trendLabel: 'vs período ant.' },
    { label: 'Alumnos en riesgo',  value: '—', icon: 'fa-triangle-exclamation',   color: '#EF4444', trend: 5,    trendLabel: 'esta semana' },
  ]);

  riskCounts = signal({ green: 0, yellow: 0, red: 0 });

  weeklyData = [78, 85, 82, 90, 88];

  activities: ActivityItem[] = [
    { icon: 'fa-qrcode',                 iconColor: '#10B981', text: 'Asistencia registrada — Grupo 3A',           time: 'hace 8 min',  initials: 'RC' },
    { icon: 'fa-star',                   iconColor: '#F59E0B', text: 'Calificación actualizada: Matemáticas 9.5',  time: 'hace 24 min', initials: 'MA' },
    { icon: 'fa-bell',                   iconColor: '#8B5CF6', text: 'Notificación enviada: 3 alumnos en riesgo',  time: 'hace 1 h',    initials: 'SY' },
    { icon: 'fa-user-plus',              iconColor: '#3B82F6', text: 'Nuevo alumno registrado: Luis Hernández',    time: 'hace 2 h',    initials: 'AD' },
    { icon: 'fa-triangle-exclamation',   iconColor: '#EF4444', text: 'Alerta: Mario Solís — 62% asistencia',       time: 'hace 3 h',    initials: 'SY' },
  ];

  calendarDays = signal<number[]>([]);
  private readonly calMonth = new Date().getMonth();
  private readonly calYear  = new Date().getFullYear();

  eventDays = [5, 12, 18, 25, 28];

  upcomingEvents = [
    { date: 'Jue 26 Jun', label: 'Entrega de calificaciones parciales', color: '#7C1D2E' },
    { date: 'Lun 30 Jun', label: 'Reunión de padres de familia',         color: '#3B82F6' },
    { date: 'Vie 4 Jul',  label: 'Fin de ciclo escolar 2025–2026',       color: '#10B981' },
  ];

  get userRole() { return this.auth.user()?.role || 'ADMIN'; }
  get isAdmin()   { return this.userRole === 'ADMIN'; }
  get isTeacher() { return this.userRole === 'TEACHER'; }
  get isStudent() { return this.userRole === 'STUDENT'; }
  get isParent()  { return this.userRole === 'PARENT'; }
  get isAdminOrTeacher() { return this.isAdmin || this.isTeacher; }

  // Datos específicos para Vista de Padre/Tutor
  childName = 'Luis Martínez Hernández';
  childGroup = '3° A · Programación';
  childEnrollment = '2024-001';

  childGrades = [
    { subject: 'Matemáticas IV', code: 'MAT-401', p1: 8.5, p2: 9.0, p3: 9.5, final: 9.0, status: 'EXCELLENT' },
    { subject: 'Física III', code: 'FIS-301', p1: 7.8, p2: 8.2, p3: 8.6, final: 8.2, status: 'REGULAR' },
    { subject: 'Programación Web', code: 'PRO-501', p1: 9.5, p2: 9.8, p3: 10.0, final: 9.8, status: 'EXCELLENT' },
    { subject: 'Base de Datos', code: 'BD-401', p1: 8.7, p2: 8.8, p3: 9.2, final: 8.9, status: 'REGULAR' },
    { subject: 'Inglés IV', code: 'ING-401', p1: 10.0, p2: 10.0, p3: 10.0, final: 10.0, status: 'EXCELLENT' }
  ];

  childScheduleToday = [
    { time: '07:00 – 08:30', subject: 'Matemáticas IV', room: 'Aula A-101', teacher: 'Juan Pérez' },
    { time: '08:30 – 10:00', subject: 'Física III', room: 'Aula A-101', teacher: 'Pedro Sánchez' },
    { time: '10:00 – 11:30', subject: 'Programación Web', room: 'Lab. Cómputo 1', teacher: 'María González' },
    { time: '11:30 – 13:00', subject: 'Inglés IV', room: 'Aula A-101', teacher: 'Ana López' }
  ];

  childTeachers = [
    { name: 'Juan Pérez García', specialty: 'Matemáticas IV', email: 'juan.perez@cbtis61.edu.mx' },
    { name: 'María González Ruiz', specialty: 'Programación Web', email: 'maria.gonzalez@cbtis61.edu.mx' },
    { name: 'Pedro Sánchez Torres', specialty: 'Física III', email: 'pedro.sanchez@cbtis61.edu.mx' },
    { name: 'Ana López Martínez', specialty: 'Inglés IV', email: 'ana.lopez@cbtis61.edu.mx' }
  ];

  // Datos para Vista Docente
  teacherClassesToday = [
    { time: '07:00 – 08:30', subject: 'Matemáticas IV', group: 'Grupo 3A', room: 'Aula A-101', status: 'Tomada' },
    { time: '10:00 – 11:30', subject: 'Ética Profesional', group: 'Grupo 3A', room: 'Aula A-101', status: 'Pendiente' },
    { time: '13:30 – 15:00', subject: 'Matemáticas IV', group: 'Grupo 3B', room: 'Aula A-102', status: 'Pendiente' }
  ];

  get greetingText() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get firstName() {
    const u = this.auth.user();
    if (u?.firstName) return u.firstName;
    if (this.isStudent) return 'Alumno';
    if (this.isParent) return 'Tutor';
    if (this.isTeacher) return 'Docente';
    return 'Usuario';
  }

  get todayLabel() {
    return this.today.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  get monthLabel() {
    return new Date(this.calYear, this.calMonth, 1)
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  aiInsight = signal<any | null>(null);
  aiLoading = signal(false);

  fetchAiInsight() {
    if (this.aiLoading()) return;
    this.aiLoading.set(true);

    const user = this.auth.user();
    const targetStudentId = this.isStudent
      ? user?.studentProfile?.id
      : this.isParent
        ? user?.parentProfile?.children?.[0]?.id
        : null;

    const url = this.isAdminOrTeacher
      ? `${API}/ai-insights/dashboard`
      : targetStudentId
        ? `${API}/ai-insights/students/${targetStudentId}`
        : null;

    if (!url) {
      this.aiLoading.set(false);
      return;
    }

    this.http.post<any>(url, {}).subscribe({
      next: (res) => {
        const normalized = {
          ...res,
          institutionalOverview: res.institutionalOverview || res.summary,
          keyObservations: res.keyObservations || res.highlights || res.strengths || [],
          executiveActions: res.executiveActions || res.recommendations || res.actionPlan || [],
          riskAnalysis: res.riskAnalysis || (Array.isArray(res.concerns) && res.concerns.length > 0 ? res.concerns.join(' · ') : null)
        };
        this.aiInsight.set(normalized);
        this.aiLoading.set(false);
      },
      error: () => this.aiLoading.set(false)
    });
  }

  ngOnInit() {
    this.buildCalendar();
    this.fetchData();
  }

  ngAfterViewInit() {
    this.chartReady = true;
    setTimeout(() => this.initChart(this.weeklyData), 200);
  }

  private fetchData() {
    const user = this.auth.user();
    const targetStudentId = this.isStudent
      ? user?.studentProfile?.id
      : this.isParent
        ? user?.parentProfile?.children?.[0]?.id
        : null;

    if (!this.isAdminOrTeacher) {
      // Para Padre y Alumno: consultar notificaciones, calificaciones y asistencias específicas
      if (this.isParent && user?.parentProfile?.children?.[0]) {
        const child = user.parentProfile.children[0];
        if (child.user) {
          this.childName = `${child.user.firstName} ${child.user.lastName}`;
        }
        if (child.group?.name) {
          this.childGroup = child.group.name;
        }
        if (child.enrollmentId) {
          this.childEnrollment = child.enrollmentId;
        }
      }

      forkJoin({
        myNotifs:   this.http.get<any[]>(`${API}/notifications/my-notifications`).pipe(catchError(() => of<any[]>([]))),
        grades:     targetStudentId ? this.http.get<any[]>(`${API}/grades/student/${targetStudentId}`).pipe(catchError(() => of<any[]>([]))) : of<any[]>([]),
        attendance: targetStudentId ? this.http.get<any[]>(`${API}/attendance/student/${targetStudentId}`).pipe(catchError(() => of<any[]>([]))) : of<any[]>([]),
      }).subscribe({
        next: (data) => {
          if (data.myNotifs && data.myNotifs.length > 0) {
            this.activities = data.myNotifs.slice(0, 5).map((n: any) => ({
              icon: n.channel === 'EMAIL' ? 'fa-envelope' : (n.channel === 'SMS' ? 'fa-comment-sms' : 'fa-bell'),
              iconColor: n.channel === 'EMAIL' ? '#3B82F6' : '#7C1D2E',
              text: n.content ?? 'Aviso institucional',
              time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'reciente',
              initials: 'SY'
            }));
          }

          // Asistencia
          const att = data.attendance ?? [];
          const present = att.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
          const attRate = att.length ? (present / att.length) * 100 : 96;

          // Promedio
          const grades = data.grades ?? [];
          const vals: number[] = [];
          for (const g of grades) {
            const v = g.finalGrade ?? [g.partial1, g.partial2, g.partial3].filter((x: any) => x != null)
              .reduce((a: number, b: number, _i: number, arr: number[]) => a + b / arr.length, 0);
            if (v) vals.push(v);
          }
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 9.0;

          if (grades.length > 0) {
            this.childGrades = grades.map((g: any) => ({
              subject: g.subject?.name ?? 'Materia',
              code: g.subject?.code ?? '',
              p1: g.partial1 ?? '—',
              p2: g.partial2 ?? '—',
              p3: g.partial3 ?? '—',
              final: g.finalGrade ?? '—',
              status: (g.finalGrade && g.finalGrade >= 9) ? 'EXCELLENT' : 'REGULAR'
            }));
          }

          this.applyStats(0, Math.round(attRate * 10) / 10, avg, 0);
        },
        error: () => this.applyStats(0, 95, 9.0, 0)
      });
      return;
    }

    forkJoin({
      users:        this.http.get<any[]>(`${API}/users`).pipe(catchError(() => of<any[]>([]))),
      attendance:   this.http.get<any[]>(`${API}/attendance`).pipe(catchError(() => of<any[]>([]))),
      grades:       this.http.get<any[]>(`${API}/grades`).pipe(catchError(() => of<any[]>([]))),
      red:          this.http.get<any[]>(`${API}/attendance/semaphore/red`).pipe(catchError(() => of<any[]>([]))),
      myNotifs:     this.http.get<any[]>(`${API}/notifications/my-notifications`).pipe(catchError(() => of<any[]>([]))),
    }).subscribe({
      next: (data) => {
        const students = (data.users ?? []).filter((u: any) => u.role === 'STUDENT');
        const total = students.length;
        const risk  = (data.red ?? []).length;

        // Si existen notificaciones reales del backend, mapearlas a la sección de Actividad y Avisos
        if (data.myNotifs && data.myNotifs.length > 0) {
          this.activities = data.myNotifs.slice(0, 5).map((n: any) => ({
            icon: n.channel === 'EMAIL' ? 'fa-envelope' : (n.channel === 'SMS' ? 'fa-comment-sms' : 'fa-bell'),
            iconColor: n.channel === 'EMAIL' ? '#3B82F6' : '#7C1D2E',
            text: n.content ?? 'Aviso institucional',
            time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'reciente',
            initials: 'SY'
          }));
        }

        // Asistencia general: % de registros presentes/tarde
        const att = data.attendance ?? [];
        const present = att.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const attRate = att.length ? (present / att.length) * 100 : 0;

        // Promedio académico: media de finalGrade (o parciales disponibles)
        const grades = data.grades ?? [];
        const vals: number[] = [];
        for (const g of grades) {
          const v = g.finalGrade ?? [g.partial1, g.partial2, g.partial3].filter((x: any) => x != null)
            .reduce((a: number, b: number, _i: number, arr: number[]) => a + b / arr.length, 0);
          if (v) vals.push(v);
        }
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

        if (grades.length > 0) {
          this.childGrades = grades.map((g: any) => ({
            subject: g.subject?.name ?? 'Materia',
            code: g.subject?.code ?? '',
            p1: g.partial1 ?? '—',
            p2: g.partial2 ?? '—',
            p3: g.partial3 ?? '—',
            final: g.finalGrade ?? '—',
            status: g.status ?? 'REGULAR'
          }));
        }

        this.applyStats(total, Math.round(attRate * 10) / 10, avg, risk);
      },
      error: () => this.applyStats(0, 0, 0, 0)
    });
  }

  private applyStats(total: number, att: number, avg: number, risk: number) {
    if (this.isStudent) {
      this.kpis.set([
        { label: 'Mi promedio general',  value: avg ? avg.toFixed(1) : '9.1', icon: 'fa-star',            color: '#F59E0B', trend: 0.3,  trendLabel: 'este parcial' },
        { label: 'Mi asistencia',        value: `${att || 95}%`,              icon: 'fa-circle-check',   color: '#10B981', trend: 1.5,  trendLabel: 'mes actual' },
        { label: 'Materias activas',     value: '6 materias',                 icon: 'fa-book',           color: '#3B82F6', trend: 0,    trendLabel: 'Semestre 2026-A' },
        { label: 'Estatus escolar',      value: 'Aprobado',                   icon: 'fa-user-shield',    color: '#7C1D2E', trend: 0,    trendLabel: 'Sin riesgo' },
      ]);
    } else if (this.isParent) {
      this.kpis.set([
        { label: 'Asistencia de mi hijo', value: `${att || 96}%`,              icon: 'fa-circle-check',   color: '#10B981', trend: 0,    trendLabel: 'Asistió hoy 8:00 AM' },
        { label: 'Promedio académico',    value: avg ? avg.toFixed(1) : '8.8', icon: 'fa-star',            color: '#F59E0B', trend: 0.2,  trendLabel: 'Parcial actual' },
        { label: 'Grupo asignado',        value: '3° A',                       icon: 'fa-users-line',     color: '#3B82F6', trend: 0,    trendLabel: 'Turno Matutino' },
        { label: 'Notificaciones tutor',  value: 'Sin alertas',                icon: 'fa-bell',           color: '#7C1D2E', trend: 0,    trendLabel: 'Al día' },
      ]);
    } else {
      this.kpis.set([
        { label: 'Total alumnos',      value: total || 120,    icon: 'fa-user-graduate',       color: '#3B82F6', trend: 0,    trendLabel: 'este período' },
        { label: 'Asistencia general', value: `${att || 92}%`, icon: 'fa-circle-check',        color: '#10B981', trend: 2.3,  trendLabel: 'vs semana ant.' },
        { label: 'Promedio académico', value: avg ? avg.toFixed(1) : '8.6', icon: 'fa-star',   color: '#F59E0B', trend: -0.4, trendLabel: 'vs período ant.' },
        { label: 'Alumnos en riesgo',  value: risk || 3,       icon: 'fa-triangle-exclamation', color: '#EF4444', trend: 5, trendLabel: 'esta semana' },
      ]);
    }

    const totalCount = total || 120;
    const yellow = Math.min(Math.max(totalCount - risk, 0), Math.round(totalCount * 0.18));
    const green = Math.max(totalCount - risk - yellow, 0);
    this.riskCounts.set({ green, yellow, red: risk });
    this.loading.set(false);
  }

  private buildCalendar() {
    const firstDay = new Date(this.calYear, this.calMonth, 1).getDay();
    const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
    const days: number[] = [];
    for (let i = 0; i < firstDay; i++) days.push(0);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    this.calendarDays.set(days);
  }

  private initChart(data: number[]) {
    if (typeof Chart === 'undefined' || !this.chartCanvas?.nativeElement) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(124, 29, 46, 0.88)');
    gradient.addColorStop(1, 'rgba(124, 29, 46, 0.18)');

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
        datasets: [{
          label: 'Asistencia',
          data,
          backgroundColor: gradient,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 40,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c: any) => ` ${c.raw}% asistencia` },
            backgroundColor: '#1A1A2E',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 13, weight: '600' },
          }
        },
        scales: {
          y: {
            min: 60, max: 100,
            grid: { color: '#F3F4F6', drawBorder: false },
            ticks: { callback: (v: any) => `${v}%`, font: { size: 11 }, color: '#9CA3AF' },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 12 }, color: '#6B7280' },
            border: { display: false }
          }
        }
      }
    });
  }

  isToday(day: number): boolean {
    const t = new Date();
    return day === t.getDate() && this.calMonth === t.getMonth() && this.calYear === t.getFullYear();
  }

  isEventDay(day: number): boolean {
    return this.eventDays.includes(day);
  }
}
