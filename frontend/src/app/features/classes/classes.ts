import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo'
};
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './classes.html',
  styleUrl: './classes.css'
})
export class ClassesComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  all     = signal<any[]>([]);
  search  = signal('');

  subjects   = signal<any[]>([]);
  groups     = signal<any[]>([]);
  teachers   = signal<any[]>([]);
  semesters  = signal<any[]>([]);
  classrooms = signal<any[]>([]);

  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  // Horarios locales (se envían con la clase)
  localSchedules = signal<any[]>([]);
  scheduleDay    = signal('MONDAY');
  scheduleStart  = signal('07:00');
  scheduleEnd    = signal('08:30');
  scheduleRoom   = signal<number | null>(null);
  scheduleError  = signal('');

  dayOptions = DAY_ORDER.map(d => ({ value: d, label: DAY_LABELS[d] }));

  form = this.fb.group({
    subjectId:   [null as number | null, Validators.required],
    groupId:     [null as number | null, Validators.required],
    teacherId:   [null as number | null, Validators.required],
    semesterId:  [null as number | null, Validators.required],
    classroomId: [null as number | null],
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(c =>
      !q ||
      normalizeText(c.subject?.name ?? '').includes(q) ||
      normalizeText(c.group?.name ?? '').includes(q) ||
      normalizeText(`${c.teacher?.user?.firstName} ${c.teacher?.user?.lastName}`).includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }
  get hasSemesters() { return this.semesters().length > 0; }

  ngOnInit() {
    this.loadCatalogs();
    this.fetchAll();
  }

  private loadCatalogs() {
    forkJoin({
      subjects: this.http.get<any[]>(`${API}/subjects`).pipe(catchError(() => of([]))),
      groups:   this.http.get<any[]>(`${API}/groups`).pipe(catchError(() => of([]))),
      users:    this.http.get<any[]>(`${API}/users`).pipe(catchError(() => of([]))),
    }).subscribe(({ subjects, groups, users }) => {
      this.subjects.set(subjects ?? []);
      this.groups.set(groups ?? []);
      this.teachers.set(
        (users ?? []).filter(u => u.role === 'TEACHER' && u.teacherProfile)
          .map(u => ({ id: u.teacherProfile.id, name: `${u.firstName} ${u.lastName}` }))
      );
    });
  }

  fetchAll() {
    this.http.get<any[]>(`${API}/classes`).subscribe({
      next: data => {
        this.all.set(data ?? []);
        this.deriveCatalogs();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private deriveCatalogs() {
    const sem = new Map<number, any>();
    const rooms = new Map<number, any>();
    for (const c of this.all()) {
      if (c.semester?.id && !sem.has(c.semester.id)) sem.set(c.semester.id, c.semester);
      if (c.classroom?.id && !rooms.has(c.classroom.id)) rooms.set(c.classroom.id, c.classroom);
      for (const s of c.schedules ?? []) {
        if (s.classroom?.id && !rooms.has(s.classroom.id)) rooms.set(s.classroom.id, s.classroom);
      }
    }
    this.semesters.set([...sem.values()]);
    this.classrooms.set([...rooms.values()]);
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.localSchedules.set([]);
    this.resetScheduleFields();
    this.form.reset({ subjectId: null, groupId: null, teacherId: null, semesterId: null, classroomId: null });
    this.modalOpen.set(true);
  }

  openEdit(c: any) {
    this.editing.set(c);
    this.formError.set('');
    this.localSchedules.set((c.schedules ?? []).map((s: any) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      classroomId: s.classroomId ?? null,
    })));
    this.resetScheduleFields();
    this.form.patchValue({
      subjectId:   c.subjectId ?? c.subject?.id ?? null,
      groupId:     c.groupId ?? c.group?.id ?? null,
      teacherId:   c.teacherId ?? c.teacher?.id ?? null,
      semesterId:  c.semesterId ?? c.semester?.id ?? null,
      classroomId: c.classroomId ?? c.classroom?.id ?? null,
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  // ── Horarios locales ──
  private resetScheduleFields() {
    this.scheduleDay.set('MONDAY');
    this.scheduleStart.set('07:00');
    this.scheduleEnd.set('08:30');
    this.scheduleRoom.set(null);
    this.scheduleError.set('');
  }

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  addSchedule() {
    const day = this.scheduleDay();
    const start = this.scheduleStart();
    const end = this.scheduleEnd();
    const room = this.scheduleRoom();

    if (!day || !start || !end) {
      this.scheduleError.set('Completa día, hora inicio y hora fin');
      return;
    }
    if (this.timeToMinutes(start) >= this.timeToMinutes(end)) {
      this.scheduleError.set('La hora de inicio debe ser menor que la hora de fin');
      return;
    }

    // Verificar choques locales
    const existing = this.localSchedules();
    for (const s of existing) {
      if (s.dayOfWeek !== day) continue;
      if (!(start < s.endTime && s.startTime < end)) continue;
      if (room && s.classroomId === room) {
        this.scheduleError.set(`El aula ya está ocupada ${DAY_LABELS[day]} ${s.startTime}–${s.endTime}`);
        return;
      }
    }

    this.localSchedules.update(list => [...list, { dayOfWeek: day, startTime: start, endTime: end, classroomId: room }]);
    this.resetScheduleFields();
  }

  removeSchedule(index: number) {
    this.localSchedules.update(list => list.filter((_, i) => i !== index));
  }

  dayLabel(day: string): string {
    return DAY_LABELS[day] ?? day;
  }

  // ── Save ──
  save(addAnother = false) {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.form.value;
    const body: any = {
      subjectId:  Number(v.subjectId),
      groupId:    Number(v.groupId),
      teacherId:  Number(v.teacherId),
      semesterId: Number(v.semesterId),
      schedules:  this.localSchedules(),
    };
    if (v.classroomId) body.classroomId = Number(v.classroomId);

    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/classes/${editing.id}`, body)
      : this.http.post(`${API}/classes`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast(editing ? 'Clase actualizada' : 'Clase creada', true);
        if (addAnother && !editing) {
          this.form.patchValue({ subjectId: null, teacherId: null, classroomId: null });
          this.localSchedules.set([]);
          this.fetchAll();
        } else {
          this.modalOpen.set(false);
          this.loading.set(true);
          this.fetchAll();
        }
      },
      error: (err) => {
        this.saving.set(false);
        const m = err?.error?.message;
        this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar'));
      }
    });
  }

  remove(c: any) {
    if (this.deleting()) return;
    const label = `${c.subject?.name ?? 'Clase'} — ${c.group?.name ?? ''}`;
    if (!confirm(`¿Eliminar la clase "${label}"? Esto también eliminará sus horarios y asistencias.`)) return;
    this.deleting.set(c.id);
    this.http.delete(`${API}/classes/${c.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== c.id));
        this.showToast('Clase eliminada', true);
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

  teacherName(c: any): string {
    const u = c.teacher?.user;
    return u ? `${u.firstName} ${u.lastName}` : '—';
  }
  teacherInitials(c: any): string {
    const u = c.teacher?.user;
    return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : '—';
  }
}
