import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './subjects.html',
  styleUrl: './subjects.css'
})
export class SubjectsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading  = signal(true);
  all      = signal<any[]>([]);
  teachers = signal<any[]>([]);
  search   = signal('');

  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    name:        ['', Validators.required],
    code:        ['', Validators.required],
    description: [''],
    credits:     [null as number | null, [Validators.min(0)]],
    teacherId:   [null as number | null],
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(s =>
      !q ||
      normalizeText(s.name ?? '').includes(q) ||
      normalizeText(s.code ?? '').includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() {
    this.fetchAll();
    this.http.get<any[]>(`${API}/users`).subscribe({
      next: users => this.teachers.set(
        users.filter(u => u.role === 'TEACHER' && u.teacherProfile)
             .map(u => ({ id: u.teacherProfile.id, name: `${u.firstName} ${u.lastName}` }))
      ),
      error: () => {}
    });
  }

  fetchAll() {
    this.http.get<any[]>(`${API}/subjects`).subscribe({
      next: data => { this.all.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ name: '', code: '', description: '', credits: null, teacherId: null });
    this.modalOpen.set(true);
  }

  openEdit(s: any) {
    this.editing.set(s);
    this.formError.set('');
    this.form.patchValue({
      name: s.name, code: s.code,
      description: s.description ?? '',
      credits: s.credits ?? null,
      teacherId: s.teacherId ?? s.teacher?.id ?? null,
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save(addAnother = false) {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.form.value;
    const body: any = { name: v.name, code: v.code };
    if (v.description) body.description = v.description;
    if (v.credits !== null && v.credits !== undefined) body.credits = Number(v.credits);
    if (v.teacherId) body.teacherId = Number(v.teacherId);

    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/subjects/${editing.id}`, body)
      : this.http.post(`${API}/subjects`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast(editing ? 'Materia actualizada' : 'Materia creada', true);
        if (addAnother && !editing) {
          this.form.reset({ name: '', code: '', description: '', credits: null, teacherId: null });
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

  remove(s: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar la materia "${s.name}"?`)) return;
    this.deleting.set(s.id);
    this.http.delete(`${API}/subjects/${s.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== s.id));
        this.showToast('Materia eliminada', true);
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

  teacherName(s: any): string {
    const u = s.teacher?.user;
    return u ? `${u.firstName} ${u.lastName}` : '—';
  }
}
