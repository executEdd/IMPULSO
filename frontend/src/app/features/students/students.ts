import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './students.html',
  styleUrl: './students.css'
})
export class StudentsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading  = signal(true);
  all      = signal<any[]>([]);
  search   = signal('');

  // ── Drawer de perfil ──
  selected      = signal<any | null>(null);
  drawerLoading = signal(false);
  stats         = signal<{ absences: number; totalClasses: number; attendanceRate: string } | null>(null);
  history       = signal<any[]>([]);
  studentGrades = signal<any[]>([]);
  resetting     = signal(false);

  // ── Modal alta/edición ──
  modalOpen  = signal(false);
  editing    = signal<any | null>(null);
  saving     = signal(false);
  deleting   = signal<number | null>(null);
  formError  = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    firstName:    ['', Validators.required],
    lastName:     ['', Validators.required],
    email:        ['', [Validators.required, Validators.email]],
    password:     ['', [Validators.required, Validators.minLength(6)]],
    enrollmentId: ['', Validators.required],
    phone:        [''],
  });
  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(s =>
      !q ||
      s.user?.firstName?.toLowerCase().includes(q) ||
      s.user?.lastName?.toLowerCase().includes(q)  ||
      s.enrollmentId?.toLowerCase().includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/users`).subscribe({
      next: users => {
        const students = users
          .filter(u => u.role === 'STUDENT')
          .map(u => ({ ...u.studentProfile, user: u }));
        this.all.set(students);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Perfil ──
  openProfile(s: any) {
    this.selected.set(s);
    this.drawerLoading.set(true);
    this.stats.set(null);
    this.history.set([]);
    this.studentGrades.set([]);

    forkJoin({
      stats:   this.http.get<any>(`${API}/attendance/stats/student/${s.id}`).pipe(catchError(() => of(null))),
      history: this.http.get<any[]>(`${API}/attendance/student/${s.id}`).pipe(catchError(() => of([]))),
      grades:  this.http.get<any[]>(`${API}/grades/student/${s.id}`).pipe(catchError(() => of([]))),
    }).subscribe(({ stats, history, grades }) => {
      this.stats.set(stats);
      this.history.set((history ?? []).slice(0, 10));
      this.studentGrades.set(grades ?? []);
      this.drawerLoading.set(false);
    });
  }

  closeProfile() { this.selected.set(null); }

  resetSemaphore() {
    const s = this.selected();
    if (!s || this.resetting()) return;
    this.resetting.set(true);
    this.http.post(`${API}/attendance/semaphore/reset/${s.id}`, {}).subscribe({
      next: () => {
        this.resetting.set(false);
        this.selected.update(sel => sel ? { ...sel, semaphore: 'GREEN' } : sel);
        this.all.update(list => list.map(x => x.id === s.id ? { ...x, semaphore: 'GREEN' } : x));
        this.showToast('Semáforo restablecido a verde', true);
      },
      error: (err) => {
        this.resetting.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo restablecer el semáforo', false);
      }
    });
  }

  // ── CRUD ──
  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset();
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  openEdit(s: any) {
    this.editing.set(s);
    this.formError.set('');
    this.form.patchValue({
      firstName:    s.user?.firstName ?? '',
      lastName:     s.user?.lastName ?? '',
      email:        s.user?.email ?? '',
      enrollmentId: s.enrollmentId ?? '',
      phone:        s.phone ?? '',
      password:     '',
    });
    // en edición la contraseña es opcional
    this.form.get('password')?.setValidators([Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.form.value;

    const editing = this.editing();
    if (editing) {
      const body: any = {
        firstName: v.firstName, lastName: v.lastName,
        email: v.email, enrollmentId: v.enrollmentId,
      };
      if (v.phone) body.phone = v.phone;
      if (v.password) body.password = v.password;
      this.http.put(`${API}/users/${editing.user.id}`, body).subscribe({
        next: () => this.afterSave('Alumno actualizado'),
        error: (err) => this.saveError(err)
      });
    } else {
      const body: any = {
        firstName: v.firstName, lastName: v.lastName,
        email: v.email, password: v.password,
        role: 'STUDENT', enrollmentId: v.enrollmentId,
      };
      if (v.phone) body.phone = v.phone;
      this.http.post(`${API}/users`, body).subscribe({
        next: () => this.afterSave('Alumno registrado'),
        error: (err) => this.saveError(err)
      });
    }
  }

  private afterSave(msg: string) {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.showToast(msg, true);
    this.loading.set(true);
    this.fetchAll();
  }

  private saveError(err: any) {
    this.saving.set(false);
    const m = err?.error?.message;
    this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar'));
  }

  remove(s: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar a ${s.user?.firstName} ${s.user?.lastName}? Esta acción no se puede deshacer.`)) return;
    this.deleting.set(s.user.id);
    this.http.delete(`${API}/users/${s.user.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.user.id !== s.user.id));
        if (this.selected()?.user?.id === s.user.id) this.closeProfile();
        this.showToast('Alumno eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar', false);
      }
    });
  }

  // ── Helpers ──
  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
  semColor(s: string) {
    return s === 'GREEN' ? 'chip-green' : s === 'YELLOW' ? 'chip-yellow' : 'chip-red';
  }
  semLabel(s: string) {
    return s === 'GREEN' ? 'Verde' : s === 'YELLOW' ? 'Amarillo' : 'Rojo';
  }
  initials(s: any) {
    return `${s.user?.firstName?.[0] ?? ''}${s.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
  attStatusChip(st: string) {
    const m: Record<string, string> = {
      PRESENT: 'chip-green', LATE: 'chip-yellow', ABSENT: 'chip-red', JUSTIFIED: 'chip-yellow'
    };
    return m[st] ?? 'chip-neutral';
  }
  attStatusLabel(st: string) {
    const m: Record<string, string> = {
      PRESENT: 'Presente', LATE: 'Tardanza', ABSENT: 'Ausente', JUSTIFIED: 'Justificado'
    };
    return m[st] ?? st;
  }
  gradeChip(val: number | null): string {
    if (val === null || val === undefined) return 'chip-neutral';
    if (val >= 9) return 'chip-green';
    if (val >= 7) return 'chip-yellow';
    return 'chip-red';
  }
}
