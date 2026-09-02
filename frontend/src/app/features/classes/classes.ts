import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

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

  // catálogos
  subjects   = signal<any[]>([]);
  groups     = signal<any[]>([]);
  teachers   = signal<any[]>([]);
  semesters  = signal<any[]>([]);   // derivados de clases existentes
  classrooms = signal<any[]>([]);   // derivados de clases existentes

  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

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

  /** Semestres y aulas no tienen endpoint propio; se derivan de las clases existentes */
  private deriveCatalogs() {
    const sem = new Map<number, any>();
    const rooms = new Map<number, any>();
    for (const c of this.all()) {
      if (c.semester?.id && !sem.has(c.semester.id)) sem.set(c.semester.id, c.semester);
      if (c.classroom?.id && !rooms.has(c.classroom.id)) rooms.set(c.classroom.id, c.classroom);
    }
    this.semesters.set([...sem.values()]);
    this.classrooms.set([...rooms.values()]);
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ subjectId: null, groupId: null, teacherId: null, semesterId: null, classroomId: null });
    this.modalOpen.set(true);
  }

  openEdit(c: any) {
    this.editing.set(c);
    this.formError.set('');
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
          this.form.patchValue({
            subjectId: null,
            teacherId: null,
            classroomId: null
          });
          this.fetchAll(); // refresca en segundo plano
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
    if (!confirm(`¿Eliminar la clase "${label}"?`)) return;
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
