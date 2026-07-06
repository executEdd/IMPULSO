import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';

@Component({
  selector: 'app-grades',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './grades.html',
  styleUrl: './grades.css'
})
export class GradesComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  all     = signal<any[]>([]);
  search  = signal('');
  activeTab = signal<'grades' | 'logs'>('grades');

  // logs (auditoría, solo admin)
  logs        = signal<any[]>([]);
  logsLoading = signal(false);
  logsLoaded  = false;

  // modal captura/edición
  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  formError = signal('');

  // catálogos derivados
  students = signal<any[]>([]);
  subjects = signal<any[]>([]);

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    studentId: [null as number | null, Validators.required],
    subjectId: [null as number | null, Validators.required],
    period:    ['2025-2026A', Validators.required],
    partial1:  [null as number | null, [Validators.min(0), Validators.max(100)]],
    partial2:  [null as number | null, [Validators.min(0), Validators.max(100)]],
    partial3:  [null as number | null, [Validators.min(0), Validators.max(100)]],
  });

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(g =>
      !q ||
      g.student?.user?.firstName?.toLowerCase().includes(q) ||
      g.student?.user?.lastName?.toLowerCase().includes(q)  ||
      g.subject?.name?.toLowerCase().includes(q)
    );
  });

  get isAdmin()   { return this.auth.user()?.role === 'ADMIN'; }
  get canEdit()   { const r = this.auth.user()?.role; return r === 'ADMIN' || r === 'TEACHER'; }

  ngOnInit() {
    this.fetchGrades();
    this.http.get<any[]>(`${API}/users`).subscribe({
      next: users => this.students.set(
        users.filter(u => u.role === 'STUDENT' && u.studentProfile)
             .map(u => ({ id: u.studentProfile.id, name: `${u.firstName} ${u.lastName}` }))
      ),
      error: () => {}
    });
  }

  fetchGrades() {
    this.http.get<any[]>(`${API}/grades`).subscribe({
      next: data => {
        this.all.set(data);
        // catálogo de materias derivado de los registros existentes
        const seen = new Map<number, any>();
        for (const g of data) {
          if (g.subject?.id && !seen.has(g.subject.id)) seen.set(g.subject.id, g.subject);
        }
        this.subjects.set([...seen.values()]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Tabs ──
  showLogs() {
    this.activeTab.set('logs');
    if (this.logsLoaded) return;
    this.logsLoading.set(true);
    this.http.get<any[]>(`${API}/grades/logs/all`).subscribe({
      next: data => {
        this.logs.set(data ?? []);
        this.logsLoaded = true;
        this.logsLoading.set(false);
      },
      error: () => this.logsLoading.set(false)
    });
  }

  // ── Captura / edición ──
  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ period: '2025-2026A' });
    this.form.get('studentId')?.enable();
    this.form.get('subjectId')?.enable();
    this.modalOpen.set(true);
  }

  openEdit(g: any) {
    this.editing.set(g);
    this.formError.set('');
    this.form.patchValue({
      studentId: g.studentId,
      subjectId: g.subjectId,
      period:    g.period ?? '2025-2026A',
      partial1:  g.partial1,
      partial2:  g.partial2,
      partial3:  g.partial3,
    });
    // alumno y materia no se cambian al editar
    this.form.get('studentId')?.disable();
    this.form.get('subjectId')?.disable();
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.form.getRawValue();

    const partials: any = {};
    if (v.partial1 !== null && v.partial1 !== undefined) partials.partial1 = Number(v.partial1);
    if (v.partial2 !== null && v.partial2 !== undefined) partials.partial2 = Number(v.partial2);
    if (v.partial3 !== null && v.partial3 !== undefined) partials.partial3 = Number(v.partial3);

    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/grades/${editing.id}`, partials)
      : this.http.post(`${API}/grades`, {
          studentId: Number(v.studentId),
          subjectId: Number(v.subjectId),
          period: v.period,
          ...partials
        });

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(editing ? 'Calificación actualizada' : 'Calificación registrada', true);
        this.loading.set(true);
        this.logsLoaded = false;
        this.fetchGrades();
      },
      error: (err) => {
        this.saving.set(false);
        const m = err?.error?.message;
        this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar'));
      }
    });
  }

  // ── Helpers ──
  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }

  gradeChip(val: number | null): string {
    if (val === null || val === undefined) return 'chip-neutral';
    if (val >= 9) return 'chip-green';
    if (val >= 7) return 'chip-yellow';
    return 'chip-red';
  }
  statusClass(s: string) {
    const m: Record<string, string> = {
      EXCELLENT: 'chip-green', REGULAR: 'chip-yellow', IRREGULAR: 'chip-red'
    };
    return m[s] ?? 'chip-yellow';
  }
  statusLabel(s: string) {
    const m: Record<string, string> = {
      EXCELLENT: 'Excelente', REGULAR: 'Regular', IRREGULAR: 'Irregular'
    };
    return m[s] ?? s;
  }
  initials(g: any) {
    return `${g.student?.user?.firstName?.[0] ?? ''}${g.student?.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
}
