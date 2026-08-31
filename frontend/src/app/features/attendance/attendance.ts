import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado'
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [DatePipe, FormsModule],
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
  marking     = signal(false);

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
