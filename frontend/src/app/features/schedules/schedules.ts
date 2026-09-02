import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado'
};
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAY_COLORS: Record<string, string> = {
  MONDAY: '#3B82F6', TUESDAY: '#8B5CF6', WEDNESDAY: '#10B981',
  THURSDAY: '#F59E0B', FRIDAY: '#7C1D2E', SATURDAY: '#6B7280'
};

const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 21; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
}
const WEEK_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css'
})
export class SchedulesComponent implements OnInit {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  loading = signal(true);
  raw     = signal<any[]>([]);
  byDay   = signal<{ day: string; label: string; color: string; items: any[] }[]>([]);

  viewMode = signal<'list' | 'calendar'>('list');
  selectedSchedule = signal<any | null>(null);
  sidePanelOpen = signal(false);

  timeSlots = TIME_SLOTS;
  weekDays = WEEK_DAYS;
  dayLabels = DAY_LABELS;
  dayColors = DAY_COLORS;

  calendarGrid = computed(() => {
    const grid = new Map<string, any[]>();
    for (const s of this.raw()) {
      const match = s.startTime?.match(/^(\d{1,2})/);
      const hour = match ? match[1].padStart(2, '0') : '00';
      const key = `${s.dayOfWeek}-${hour}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(s);
    }
    return grid;
  });

  toastMsg = signal('');
  toastOk  = signal(true);

  get isAdmin()   { return this.auth.user()?.role === 'ADMIN'; }
  get isTeacher() { return this.auth.user()?.role === 'TEACHER'; }
  get isStudent() { return this.auth.user()?.role === 'STUDENT'; }
  get isParent()  { return this.auth.user()?.role === 'PARENT'; }

  get pageTitle(): string {
    if (this.isStudent) return 'Mi Horario de Clases';
    if (this.isParent)  return 'Horario de Clases de mi Hijo/a';
    if (this.isTeacher) return 'Mi Horario de Impartición';
    return 'Horarios Escolares';
  }

  get pageSubtitle(): string {
    if (this.isStudent) return 'Consulta tus materias, aulas y profesores asignados por día';
    if (this.isParent)  return 'Consulta la programación semanal de clases de tu hijo/a';
    if (this.isTeacher) return 'Horario asignado para tus clases y grupos';
    return 'Vista general de horarios por clase, aula y día de la semana';
  }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/schedules`).subscribe({
      next: data => {
        this.raw.set(data ?? []);
        this.regroup();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private regroup() {
    const grouped: Record<string, any[]> = {};
    for (const s of this.raw()) {
      const d = s.dayOfWeek;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(s);
    }
    this.byDay.set(
      DAY_ORDER
        .filter(d => grouped[d]?.length)
        .map(d => ({
          day: d,
          label: DAY_LABELS[d] ?? d,
          color: DAY_COLORS[d] ?? '#6B7280',
          items: grouped[d].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
        }))
    );
  }

  getSlotSchedules(day: string, hour: string): any[] {
    const h = hour.substring(0, 2);
    return this.calendarGrid().get(`${day}-${h}`) ?? [];
  }

  blockTop(item: any): number {
    const minutes = this.timeToMinutes(item.startTime);
    const hourStart = parseInt(item.startTime.match(/^(\d{1,2})/)?.[1] ?? '0', 10);
    const offsetMinutes = minutes - (hourStart * 60);
    return (offsetMinutes / 60) * 64;
  }

  blockHeight(item: any): number {
    const start = this.timeToMinutes(item.startTime);
    const end = this.timeToMinutes(item.endTime);
    return Math.max(32, ((end - start) / 60) * 64);
  }

  private timeToMinutes(time: string): number {
    const match = time?.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  formatTimeRange(item: any): string {
    return `${item.startTime} – ${item.endTime}`;
  }

  openScheduleDetail(item: any) {
    this.selectedSchedule.set(item);
    this.sidePanelOpen.set(true);
  }

  closeSidePanel() {
    this.sidePanelOpen.set(false);
  }

  teacherName(item: any): string {
    const u = item.class?.teacher?.user;
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—';
  }
}
