import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './subjects.html',
  styleUrl: './subjects.css'
})
export class SubjectsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading   = signal(true);
  all       = signal<any[]>([]);
  teachers  = signal<any[]>([]);
  search    = signal('');

  // Modal
  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg  = signal('');
  toastOk   = signal(true);

  form = this.fb.group({
    name:        ['', Validators.required],
    code:        ['', Validators.required],
    description: [''],
    credits:     [1, [Validators.required, Validators.min(1)]],
    teacherId:   [null as number | null]
  });

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(s =>
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() {
    this.fetchAll();
    if (this.isAdmin) {
      this.fetchTeachers();
    }
  }

  fetchAll() {
    this.http.get<any[]>(`${API}/subjects`).subscribe({
      next: data => {
        this.all.set(data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  fetchTeachers() {
    this.http.get<any[]>(`${API}/users?role=TEACHER`).subscribe({
      next: users => {
        const list = users.map(u => ({
          id: u.teacherProfile?.id,
          name: `${u.firstName} ${u.lastName} (${u.teacherProfile?.employeeId ?? 'Docente'})`
        })).filter(t => t.id != null);
        this.teachers.set(list);
      }
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ name: '', code: '', description: '', credits: 1, teacherId: null });
    this.modalOpen.set(true);
  }

  openEdit(s: any) {
    this.editing.set(s);
    this.formError.set('');
    this.form.reset({
      name: s.name,
      code: s.code,
      description: s.description || '',
      credits: s.credits,
      teacherId: s.teacherId
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');

    const body = this.form.value;
    const isEdit = this.editing();
    const req = isEdit
      ? this.http.put(`${API}/subjects/${isEdit.id}`, body)
      : this.http.post(`${API}/subjects`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(isEdit ? 'Materia actualizada' : 'Materia registrada', true);
        this.fetchAll();
      },
      error: err => {
        this.saving.set(false);
        const msg = err?.error?.message;
        this.formError.set(Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo guardar la materia'));
      }
    });
  }

  remove(s: any) {
    if (!confirm(`¿Estás seguro de eliminar la materia "${s.name}"?`)) return;
    this.deleting.set(s.id);
    this.http.delete(`${API}/subjects/${s.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.showToast('Materia eliminada', true);
        this.fetchAll();
      },
      error: () => {
        this.deleting.set(null);
        this.showToast('No se pudo eliminar la materia', false);
      }
    });
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
