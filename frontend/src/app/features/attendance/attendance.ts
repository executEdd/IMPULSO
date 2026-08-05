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

  get canMark() { const r = this.auth.user()?.role; return r === 'ADMIN' || r === 'TEACHER'; }

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
    this.http.get<any[]>(`${API}/attendance`).subscribe({
      next: data => { this.records.set(data); this.loading.set(false); },
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
