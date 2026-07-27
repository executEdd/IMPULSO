import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

const API = (import.meta as any).env.NG_APP_API_URL;

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado'
};
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAY_COLORS: Record<string, string> = {
  MONDAY: '#3B82F6', TUESDAY: '#8B5CF6', WEDNESDAY: '#10B981',
  THURSDAY: '#F59E0B', FRIDAY: '#7C1D2E', SATURDAY: '#6B7280'
};

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css'
})
export class SchedulesComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  raw     = signal<any[]>([]);
  byDay   = signal<{ day: string; label: string; color: string; items: any[] }[]>([]);

  // catálogos derivados de los horarios existentes
  classes    = signal<any[]>([]);
  classrooms = signal<any[]>([]);

  // modal
  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');
  conflictWarning = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  dayOptions = DAY_ORDER.map(d => ({ value: d, label: DAY_LABELS[d] }));

  form = this.fb.group({
    classId:     [null as number | null, Validators.required],
    classroomId: [null as number | null],
    dayOfWeek:   ['MONDAY', Validators.required],
    startTime:   ['07:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    endTime:     ['08:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/schedules`).subscribe({
      next: data => {
        this.raw.set(data ?? []);
        this.regroup();
        this.deriveCatalogs();
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

  private deriveCatalogs() {
    const cls = new Map<number, any>();
    const rooms = new Map<number, any>();
    for (const s of this.raw()) {
      if (s.class?.id && !cls.has(s.class.id)) cls.set(s.class.id, s.class);
      if (s.classroom?.id && !rooms.has(s.classroom.id)) rooms.set(s.classroom.id, s.classroom);
    }
    this.classes.set([...cls.values()]);
    this.classrooms.set([...rooms.values()]);
  }

  classLabel(c: any): string {
    const subj = c.subject?.name ?? `Clase #${c.id}`;
    const grp = c.group?.name ? ` · ${c.group.name}` : '';
    return `${subj}${grp}`;
  }

  // ── CRUD ──
  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.conflictWarning.set('');
    this.form.reset({ dayOfWeek: 'MONDAY', startTime: '07:00', endTime: '08:00', classId: null, classroomId: null });
    this.modalOpen.set(true);
  }

  openEdit(item: any) {
    this.editing.set(item);
    this.formError.set('');
    this.conflictWarning.set('');
    this.form.patchValue({
      classId:     item.classId ?? item.class?.id ?? null,
      classroomId: item.classroomId ?? item.classroom?.id ?? null,
      dayOfWeek:   item.dayOfWeek,
      startTime:   item.startTime,
      endTime:     item.endTime,
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  /** Validación local de choques (el endpoint check-conflicts del back
      tiene un bug de orden de rutas y no es alcanzable) */
  private findConflict(v: any, excludeId?: number): string {
    const overlaps = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;
    for (const s of this.raw()) {
      if (excludeId && s.id === excludeId) continue;
      if (s.dayOfWeek !== v.dayOfWeek) continue;
      if (!overlaps(v.startTime, v.endTime, s.startTime, s.endTime)) continue;
      if (v.classroomId && s.classroomId === v.classroomId) {
        return `El aula ya está ocupada ${DAY_LABELS[s.dayOfWeek]} ${s.startTime}–${s.endTime} (${this.classLabel(s.class ?? {})})`;
      }
      const cls = this.classes().find(c => c.id === v.classId);
      if (cls && s.class?.groupId === cls.groupId) {
        return `El grupo ya tiene clase ${DAY_LABELS[s.dayOfWeek]} ${s.startTime}–${s.endTime} (${this.classLabel(s.class ?? {})})`;
      }
      if (cls && s.class?.teacherId === cls.teacherId) {
        return `El docente ya tiene clase ${DAY_LABELS[s.dayOfWeek]} ${s.startTime}–${s.endTime} (${this.classLabel(s.class ?? {})})`;
      }
    }
    return '';
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.value;

    if (v.startTime! >= v.endTime!) {
      this.formError.set('La hora de inicio debe ser antes de la hora de fin');
      return;
    }

    const conflict = this.findConflict(v, this.editing()?.id);
    if (conflict && !this.conflictWarning()) {
      // primera vez: avisar y permitir confirmar
      this.conflictWarning.set(conflict + '. Presiona Guardar de nuevo para confirmar.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const body: any = {
      classId:   Number(v.classId),
      dayOfWeek: v.dayOfWeek,
      startTime: v.startTime,
      endTime:   v.endTime,
    };
    if (v.classroomId) body.classroomId = Number(v.classroomId);

    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/schedules/${editing.id}`, body)
      : this.http.post(`${API}/schedules`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(editing ? 'Horario actualizado' : 'Horario creado', true);
        this.loading.set(true);
        this.fetchAll();
      },
      error: (err) => {
        this.saving.set(false);
        const m = err?.error?.message;
        this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar'));
      }
    });
  }

  remove(item: any) {
    if (this.deleting()) return;
    const label = `${this.classLabel(item.class ?? {})} — ${DAY_LABELS[item.dayOfWeek]} ${item.startTime}`;
    if (!confirm(`¿Eliminar el horario "${label}"?`)) return;
    this.deleting.set(item.id);
    this.http.delete(`${API}/schedules/${item.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.raw.update(list => list.filter(x => x.id !== item.id));
        this.regroup();
        this.showToast('Horario eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar', false);
      }
    });
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
