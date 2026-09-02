import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';

interface QrPayload {
  qrToken: string | null;
  qrImage: string | null;
  expiresAt: string | Date | null;
  isValid?: boolean;
}

@Component({
  selector: 'app-my-qr',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './my-qr.html',
  styleUrl: './my-qr.css'
})
export class MyQrComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  loading   = signal(true);
  refreshing = signal(false);
  qr        = signal<QrPayload | null>(null);
  nowTick   = signal(Date.now());
  toastMsg  = signal('');
  toastOk   = signal(true);

  // Admin / docente: consultar QR de un alumno
  students     = signal<any[]>([]);
  selStudentId = signal<number | null>(null);
  lookupLoading = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  get isStudent() { return this.auth.user()?.role === 'STUDENT'; }
  get canLookup() {
    const r = this.auth.user()?.role;
    return r === 'ADMIN' || r === 'TEACHER';
  }

  isValid = computed(() => {
    const q = this.qr();
    if (!q?.expiresAt) return !!q?.isValid && !!q?.qrImage;
    return new Date(q.expiresAt).getTime() > this.nowTick() && !!q.qrImage;
  });

  expiresIn = computed(() => {
    const q = this.qr();
    if (!q?.expiresAt) return null;
    const ms = new Date(q.expiresAt).getTime() - this.nowTick();
    if (ms <= 0) return 'Expirado';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const remS = s % 60;
    
    const hh = h.toString().padStart(2, '0');
    const mm = remM.toString().padStart(2, '0');
    const ss = remS.toString().padStart(2, '0');
    
    return `${hh}:${mm}:${ss}`;
  });

  ngOnInit() {
    this.timer = setInterval(() => this.nowTick.set(Date.now()), 1000);

    if (this.isStudent) {
      this.loadMyQr();
    } else if (this.canLookup) {
      this.loading.set(false);
      this.http.get<any[]>(`${API}/users`).subscribe({
        next: users => this.students.set(
          users
            .filter(u => u.role === 'STUDENT' && u.studentProfile)
            .map(u => ({
              id: u.studentProfile.id,
              name: `${u.firstName} ${u.lastName}`,
              enrollmentId: u.studentProfile.enrollmentId,
              group: u.studentProfile.group?.name
            }))
        ),
        error: () => {}
      });
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  loadMyQr() {
    this.loading.set(true);
    this.http.get<QrPayload>(`${API}/qr/my-qr`).subscribe({
      next: data => {
        this.qr.set(data);
        this.loading.set(false);
        // Si no hay QR válido, generar uno
        if (!data?.qrImage || data.isValid === false) {
          this.refresh();
        }
      },
      error: () => {
        this.loading.set(false);
        this.showToast('No se pudo cargar tu credencial QR', false);
      }
    });
  }

  refresh() {
    if (this.refreshing()) return;
    this.refreshing.set(true);

    if (this.isStudent) {
      this.http.post<QrPayload>(`${API}/qr/refresh`, {}).subscribe({
        next: data => {
          this.qr.set({ ...data, isValid: true });
          this.refreshing.set(false);
          this.showToast('Código QR renovado', true);
        },
        error: (err) => {
          this.refreshing.set(false);
          this.showToast(err?.error?.message ?? 'No se pudo renovar el QR', false);
        }
      });
      return;
    }

    // Admin fuerza regeneración
    const sid = this.selStudentId();
    if (!sid) {
      this.refreshing.set(false);
      return;
    }
    this.http.post<QrPayload>(`${API}/qr/refresh/${sid}`, {}).subscribe({
      next: data => {
        this.qr.set({ ...data, isValid: true });
        this.refreshing.set(false);
        this.showToast('QR del alumno regenerado', true);
      },
      error: (err) => {
        this.refreshing.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo regenerar el QR', false);
      }
    });
  }

  lookupStudent() {
    const sid = this.selStudentId();
    if (!sid || this.lookupLoading()) return;
    this.lookupLoading.set(true);
    this.http.get<QrPayload>(`${API}/qr/student/${sid}`).subscribe({
      next: data => {
        this.qr.set(data);
        this.lookupLoading.set(false);
        if (!data?.qrImage || data.isValid === false) {
          this.showToast('El alumno no tiene un QR vigente', false);
        }
      },
      error: (err) => {
        this.lookupLoading.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo consultar el QR', false);
      }
    });
  }

  get selectedStudent() {
    return this.students().find(s => s.id === this.selStudentId()) ?? null;
  }

  initials(): string {
    const u = this.auth.user();
    if (this.canLookup && !this.isStudent) {
      const s = this.selectedStudent;
      if (s) {
        const parts = (s.name as string).split(' ');
        return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
      }
    }
    return `${u?.firstName?.[0] ?? ''}${u?.lastName?.[0] ?? ''}`.toUpperCase();
  }

  displayName(): string {
    if (this.canLookup && !this.isStudent) {
      return this.selectedStudent?.name ?? '—';
    }
    return this.auth.fullName();
  }

  displayMeta(): string {
    if (this.canLookup && !this.isStudent) {
      const s = this.selectedStudent;
      if (!s) return 'Selecciona un alumno';
      return [s.enrollmentId, s.group].filter(Boolean).join(' · ') || 'Alumno CBTIS 61';
    }
    const u = this.auth.user();
    return u?.email ?? 'Alumno CBTIS 61';
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
