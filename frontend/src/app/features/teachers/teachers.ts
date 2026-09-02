import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './teachers.html',
  styleUrl: './teachers.css'
})
export class TeachersComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading  = signal(true);
  all      = signal<any[]>([]);
  search   = signal('');

  // Modal Alta / Edición
  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    firstName:  ['', Validators.required],
    lastName:   ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    employeeId: ['', Validators.required],
    specialty:  [''],
    phone:      [''],
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(t =>
      !q ||
      normalizeText(t.firstName ?? '').includes(q) ||
      normalizeText(t.lastName ?? '').includes(q) ||
      normalizeText(t.email ?? '').includes(q) ||
      normalizeText(t.teacherProfile?.employeeId ?? '').includes(q) ||
      normalizeText(t.teacherProfile?.specialty ?? '').includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/users?role=TEACHER`).subscribe({
      next: list => {
        this.all.set(list ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset();
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  openEdit(t: any) {
    this.editing.set(t);
    this.formError.set('');
    this.form.patchValue({
      firstName:  t.firstName ?? '',
      lastName:   t.lastName ?? '',
      email:      t.email ?? '',
      employeeId: t.teacherProfile?.employeeId ?? '',
      specialty:  t.teacherProfile?.specialty ?? '',
      phone:      t.teacherProfile?.phone ?? '',
      password:   '',
    });
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
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        employeeId: v.employeeId,
      };
      if (v.specialty) body.specialty = v.specialty;
      if (v.phone) body.phone = v.phone;
      if (v.password) body.password = v.password;

      this.http.put(`${API}/users/${editing.id}`, body).subscribe({
        next: () => this.afterSave('Docente actualizado con éxito'),
        error: (err) => this.saveError(err)
      });
    } else {
      const body: any = {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        password: v.password,
        role: 'TEACHER',
        employeeId: v.employeeId,
      };
      if (v.specialty) body.specialty = v.specialty;
      if (v.phone) body.phone = v.phone;

      this.http.post(`${API}/users`, body).subscribe({
        next: () => this.afterSave('Docente registrado con éxito'),
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
    this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar el docente'));
  }

  remove(t: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar al docente ${t.firstName} ${t.lastName}?`)) return;
    this.deleting.set(t.id);
    this.http.delete(`${API}/users/${t.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== t.id));
        this.showToast('Docente eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar al docente', false);
      }
    });
  }

  initials(t: any): string {
    return `${t.firstName?.[0] ?? ''}${t.lastName?.[0] ?? ''}`.toUpperCase();
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
