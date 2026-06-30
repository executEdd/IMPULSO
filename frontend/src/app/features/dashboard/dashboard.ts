import {
  Component, inject, signal, OnInit, AfterViewInit,
  ViewChild, ElementRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

declare var Chart: any;

const API = 'https://impulso-api.onrender.com/api';

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

  get greetingText() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get firstName() { return this.auth.user()?.firstName ?? 'Docente'; }

  get todayLabel() {
    return this.today.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  get monthLabel() {
    return new Date(this.calYear, this.calMonth, 1)
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
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
    forkJoin({
      users:      this.http.get<any[]>(`${API}/users`),
      attendance: this.http.get<any[]>(`${API}/attendance`),
      grades:     this.http.get<any[]>(`${API}/grades`),
    }).subscribe({
      next: (data) => {
        const students = (data.users ?? []).filter((u: any) => u.role === 'STUDENT');
        const total = students.length || 248;
        this.applyStats(total, 87.4, 8.2, 23);
      },
      error: () => this.applyStats(248, 87.4, 8.2, 23)
    });
  }

  private applyStats(total: number, att: number, avg: number, risk: number) {
    this.kpis.set([
      { label: 'Total alumnos',      value: total,       icon: 'fa-user-graduate',       color: '#3B82F6', trend: 0,    trendLabel: 'este período' },
      { label: 'Asistencia general', value: `${att}%`,   icon: 'fa-circle-check',        color: '#10B981', trend: 2.3,  trendLabel: 'vs semana ant.' },
      { label: 'Promedio académico', value: avg.toFixed(1), icon: 'fa-star',             color: '#F59E0B', trend: -0.4, trendLabel: 'vs período ant.' },
      { label: 'Alumnos en riesgo',  value: risk,         icon: 'fa-triangle-exclamation', color: '#EF4444', trend: 5, trendLabel: 'esta semana' },
    ]);
    this.riskCounts.set({ green: total - risk - 45, yellow: 45, red: risk });
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
