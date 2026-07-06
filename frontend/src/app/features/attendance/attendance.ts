import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';

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
export class AttendanceComponent implements OnInit {
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
