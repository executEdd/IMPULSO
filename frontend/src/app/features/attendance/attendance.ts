import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];
const DAY_NAMES = [
  'domingo','lunes','martes','miércoles','jueves','viernes','sábado'
];
const DAY_HEADER = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado'
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [DatePipe, FormsModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css'
})
export class AttendanceComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  loading = signal(true);
  records = signal<any[]>([]);

  // pase de lista manual
  schedules   = signal<any[]>([]);
  students    = signal<any[]>([]);
  selSchedule = signal<number | null>(null);
  selStudent  = signal<number | null>(null);
  // Fecha seleccionada para filtrar asistencia
  selectedDate = signal<Date | null>(null);
  filteredRecords = computed(() => {
    const date = this.selectedDate();
    if (!date) return this.records();
    const selected = new Date(date);
    return this.records().filter(r => {
      const rec = new Date(r.date);
      return rec.toDateString() === selected.toDateString();
    });
  });

  // ── Vista Calendario ──
  viewMode = signal<'list' | 'calendar'>('list');
  currentYear  = signal(new Date().getFullYear());
  currentMonth = signal(new Date().getMonth());
  selectedDay  = signal<Date | null>(null);
  sidePanelOpen = signal(false);

  monthLabel = computed(() => `${MONTH_NAMES[this.currentMonth()]} ${this.currentYear()}`);
  dayHeaders = DAY_HEADER;
  todayStr = new Date().toDateString();

  calendarDays = computed(() => {
    const year  = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Lunes=0 ... Domingo=6
    let startOffset = (firstDay.getDay() + 6) % 7;
    const cells: { day: number; date: Date; empty: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: 0, date: new Date(), empty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(year, month, d), empty: false });
    }
    return cells;
  });

  dayRecords = computed(() => {
    const sel = this.selectedDay();
    if (!sel) return [];
    return this.records().filter(r => {
      const rec = new Date(r.date);
      return rec.toDateString() === sel.toDateString();
    });
  });

  dayStats = computed(() => {
    const recs = this.dayRecords();
    return {
      total: recs.length,
      present: recs.filter(r => r.status === 'PRESENT').length,
      late:    recs.filter(r => r.status === 'LATE').length,
      absent:  recs.filter(r => r.status === 'ABSENT').length,
      justified: recs.filter(r => r.status === 'JUSTIFIED').length,
    };
  });

  prevMonth() {
    const m = this.currentMonth();
    const y = this.currentYear();
    if (m === 0) { this.currentMonth.set(11); this.currentYear.set(y - 1); }
    else this.currentMonth.set(m - 1);
  }
  nextMonth() {
    const m = this.currentMonth();
    const y = this.currentYear();
    if (m === 11) { this.currentMonth.set(0); this.currentYear.set(y + 1); }
    else this.currentMonth.set(m + 1);
  }
  goToToday() {
    const now = new Date();
    this.currentYear.set(now.getFullYear());
    this.currentMonth.set(now.getMonth());
    this.selectDay(now);
  }
  selectDay(date: Date) {
    this.selectedDay.set(date);
    this.sidePanelOpen.set(true);
  }
  closeSidePanel() {
    this.sidePanelOpen.set(false);
  }

  /** Returna el status dominante de un día para colorear el badge */
  dayDominantStatus(date: Date): string {
    const recs = this.records().filter(r => {
      const rec = new Date(r.date);
      return rec.toDateString() === date.toDateString();
    });
    if (recs.length === 0) return '';
    if (recs.some(r => r.status === 'ABSENT'))  return 'ABSENT';
    if (recs.some(r => r.status === 'LATE'))    return 'LATE';
    if (recs.some(r => r.status === 'JUSTIFIED')) return 'JUSTIFIED';
    return 'PRESENT';
  }
  dayStatusDot(date: Date): string {
    const s = this.dayDominantStatus(date);
    const m: Record<string, string> = {
      PRESENT: 'dot-green', LATE: 'dot-yellow', ABSENT: 'dot-red', JUSTIFIED: 'dot-yellow'
    };
    return m[s] ?? '';
  }

  dayRecordCount(date: Date): number {
    return this.records().filter(r => {
      const rec = new Date(r.date);
      return rec.toDateString() === date.toDateString();
    }).length;
  }
  dayCountByStatus(date: Date, status: string): number {
    return this.records().filter(r => {
      const rec = new Date(r.date);
      return rec.toDateString() === date.toDateString() && r.status === status;
    }).length;
  }

  formatDayHeader(date: Date | null): string {
    if (!date) return '';
    const day = DAY_NAMES[date.getDay()];
    const num = date.getDate();
    const month = MONTH_NAMES[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${num} de ${month} ${year}`;
  }

  // ── Exportar CSV ──
  exportCsv() {
    const data = this.filteredRecords();
    if (!data.length) return;

    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows: string[] = [];
    rows.push('Alumno,Matricula,Materia,Fecha,Estado,Notas');

    data.forEach(r => {
      const name = `${r.student?.user?.firstName ?? ''} ${r.student?.user?.lastName ?? ''}`.trim();
      const enrollment = r.student?.enrollmentId ?? '';
      const subject = r.classes?.subject?.name ?? '';
      const date = new Date(r.date).toLocaleDateString('es-MX');
      const status = this.statusLabel(r.status);
      const notes = r.notes ?? '';
      rows.push([esc(name), esc(enrollment), esc(subject), esc(date), esc(status), esc(notes)].join(','));
    });

    const encoder = new TextEncoder();
    const csvBytes = encoder.encode('\uFEFF' + rows.join('\n'));
    const blob = new Blob([csvBytes], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  marking = signal(false);
  // Registro Manual por Contraseña
  manualModalOpen = signal(false);
  manualPassword  = signal('');
  manualLoading   = signal(false);
  manualError     = signal('');

  // ── QR Smart-Check ──
  scanOpen     = signal(false);
  scanSchedule = signal<number | null>(null);
  scanToken    = signal('');
  scanning     = signal(false);
  lastScan     = signal<any | null>(null);
  camActive    = signal(false);
  camError     = signal('');
  scanMode     = signal<'usb' | 'camera'>('usb');

  @ViewChild('tokenInput') tokenInput?: ElementRef<HTMLInputElement>;
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  private mediaStream: MediaStream | null = null;
  private detectTimer: ReturnType<typeof setInterval> | null = null;

  toastMsg = signal('');
  toastOk  = signal(true);

  get isAdmin()   { return this.auth.user()?.role === 'ADMIN'; }
  get isTeacher() { return this.auth.user()?.role === 'TEACHER'; }
  get isStudent() { return this.auth.user()?.role === 'STUDENT'; }
  get isParent()  { return this.auth.user()?.role === 'PARENT'; }
  get canMark()   { const r = this.auth.user()?.role; return r === 'ADMIN' || r === 'TEACHER'; }

  get pageTitle(): string {
    if (this.isStudent) return 'Mi Asistencia';
    if (this.isParent)  return 'Asistencia de mi Hijo/a';
    return 'Asistencia';
  }
  get pageSubtitle(): string {
    if (this.isStudent) return 'Revisa tu historial de asistencia por materia y fecha';
    if (this.isParent)  return 'Consulta el registro de entrada y asistencia de tu hijo/a';
    if (this.isTeacher) return 'Toma asistencia de tus grupos mediante QR o pase de lista manual';
    return 'Historial de registros y pase de lista por QR';
  }

  ngOnInit() {
    this.fetchRecords();
    if (this.canMark) {
      this.http.get<any[]>(`${API}/schedules`).subscribe({
        next: data => this.schedules.set(data ?? []),
        error: () => {}
      });
      this.http.get<any[]>(`${API}/users`).subscribe({
        next: users => this.students.set(
          users.filter(u => u.role === 'STUDENT' && u.studentProfile)
               .map(u => ({ id: u.studentProfile.id, name: `${u.firstName} ${u.lastName}`, group: u.studentProfile.group?.name }))
        ),
        error: () => {}
      });
    }
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  fetchRecords() {
    const user = this.auth.user();
    let url = `${API}/attendance`;

    if (this.isStudent) {
      const studentId = user?.studentProfile?.id;
      if (studentId) {
        url = `${API}/attendance/student/${studentId}`;
      }
    } else if (this.isParent) {
      const childId = user?.parentProfile?.children?.[0]?.id;
      if (childId) {
        url = `${API}/attendance/student/${childId}`;
      }
    }

    this.http.get<any[]>(url).subscribe({
      next: data => { this.records.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  scheduleLabel(s: any): string {
    const day = DAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek;
    const subj = s.class?.subject?.name ?? 'Clase';
    const grp = s.class?.group?.name ? ` · ${s.class.group.name}` : '';
    return `${day} ${s.startTime}–${s.endTime} · ${subj}${grp}`;
  }

  markAbsent() {
    const studentId = this.selStudent();
    const scheduleId = this.selSchedule();
    if (!studentId || !scheduleId || this.marking()) return;
    this.marking.set(true);
    this.http.post(`${API}/attendance/mark-absent/${studentId}/${scheduleId}`, {}).subscribe({
      next: () => {
        this.marking.set(false);
        this.showToast('Falta registrada', true);
        this.selStudent.set(null);
        this.loading.set(true);
        this.fetchRecords();
      },
      error: (err) => {
        this.marking.set(false);
        const m = err?.error?.message;
        this.showToast(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'No se pudo registrar la falta'), false);
      }
    });
  }

  // ── Asistencia Manual con Contraseña ──
  openManualModal() {
    this.manualModalOpen.set(true);
    this.manualPassword.set('');
    this.manualError.set('');
  }

  closeManualModal() {
    this.manualModalOpen.set(false);
  }

  submitManualAttendance() {
    const studentId = this.selStudent();
    const classScheduleId = this.selSchedule();
    const password = this.manualPassword();

    if (!studentId || !classScheduleId || !password || this.manualLoading()) return;

    this.manualLoading.set(true);
    this.manualError.set('');

    this.http.post(`${API}/attendance/manual-present`, {
      studentId: Number(studentId),
      classScheduleId: Number(classScheduleId),
      password
    }).subscribe({
      next: () => {
        this.manualLoading.set(false);
        this.manualModalOpen.set(false);
        this.manualPassword.set('');
        this.showToast('Asistencia manual (Presente) registrada exitosamente', true);
        this.loading.set(true);
        this.fetchRecords();
      },
      error: (err) => {
        this.manualLoading.set(false);
        const m = err?.error?.message;
        this.manualError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Contraseña incorrecta o error al registrar'));
      }
    });
  }

  // ── Smart-Check QR ──
  openScan() {
    this.scanOpen.set(true);
    this.scanToken.set('');
    this.lastScan.set(null);
    this.camError.set('');
    this.scanMode.set('usb');
    this.scanSchedule.set(this.selSchedule());
    setTimeout(() => this.tokenInput?.nativeElement?.focus(), 120);
  }

  closeScan() {
    this.stopCamera();
    this.scanOpen.set(false);
    this.scanToken.set('');
    this.camActive.set(false);
  }

  setScanMode(mode: 'usb' | 'camera') {
    this.scanMode.set(mode);
    this.camError.set('');
    if (mode === 'camera') {
      this.startCamera();
    } else {
      this.stopCamera();
      setTimeout(() => this.tokenInput?.nativeElement?.focus(), 80);
    }
  }

  onTokenKeydown(ev: KeyboardEvent) {
    // Escáner USB (keyboard wedge) envía Enter al final
    if (ev.key === 'Enter') {
      ev.preventDefault();
      this.submitScan();
    }
  }

  submitScan() {
    const qrToken = this.scanToken().trim();
    const classScheduleId = this.scanSchedule();
    if (!qrToken || !classScheduleId || this.scanning()) return;

    this.scanning.set(true);
    this.http.post<any>(`${API}/attendance/scan-qr`, { qrToken, classScheduleId }).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.lastScan.set(res);
        this.scanToken.set('');
        this.showToast('Asistencia registrada (Smart-Check)', true);
        this.loading.set(true);
        this.fetchRecords();
        setTimeout(() => this.tokenInput?.nativeElement?.focus(), 80);
      },
      error: (err) => {
        this.scanning.set(false);
        const m = err?.error?.message;
        this.showToast(
          Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'QR inválido o expirado'),
          false
        );
        this.scanToken.set('');
        setTimeout(() => this.tokenInput?.nativeElement?.focus(), 80);
      }
    });
  }

  async startCamera() {
    this.stopCamera();
    this.camError.set('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.camError.set('Este navegador no soporta cámara');
        return;
      }
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      this.camActive.set(true);
      setTimeout(() => {
        const video = this.videoEl?.nativeElement;
        if (video && this.mediaStream) {
          video.srcObject = this.mediaStream;
          video.play().catch(() => {});
        }
      }, 50);
      this.startBarcodeDetect();
    } catch {
      this.camError.set('No se pudo acceder a la cámara. Usa el escáner USB o pega el token.');
      this.camActive.set(false);
    }
  }

  private startBarcodeDetect() {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      // Sin BarcodeDetector: el docente puede leer el token manualmente
      this.camError.set('Cámara activa. Si tu navegador no detecta QR automático, usa el campo de token.');
      return;
    }
    const detector = new Detector({ formats: ['qr_code'] });
    this.detectTimer = setInterval(async () => {
      const video = this.videoEl?.nativeElement;
      if (!video || video.readyState < 2 || this.scanning()) return;
      try {
        const codes = await detector.detect(video);
        if (codes?.length > 0) {
          const raw = codes[0].rawValue?.trim();
          if (raw) {
            this.scanToken.set(raw);
            this.submitScan();
          }
        }
      } catch { /* ignore frame errors */ }
    }, 700);
  }

  stopCamera() {
    if (this.detectTimer) {
      clearInterval(this.detectTimer);
      this.detectTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    const video = this.videoEl?.nativeElement;
    if (video) video.srcObject = null;
    this.camActive.set(false);
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
  statusClass(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'chip-green', LATE: 'chip-yellow',
      ABSENT: 'chip-red', JUSTIFIED: 'chip-yellow'
    };
    return m[s] ?? 'chip-yellow';
  }
  statusLabel(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'Presente', LATE: 'Tardanza',
      ABSENT: 'Ausente', JUSTIFIED: 'Justificado'
    };
    return m[s] ?? s;
  }
  statusIcon(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'fa-circle-check', LATE: 'fa-clock',
      ABSENT: 'fa-circle-xmark', JUSTIFIED: 'fa-file-circle-check'
    };
    return m[s] ?? 'fa-circle';
  }
  initials(r: any) {
    return `${r.student?.user?.firstName?.[0] ?? ''}${r.student?.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
}
