import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-parents',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './parents.html',
  styleUrl: './parents.css'
})
export class ParentsComponent implements OnInit {
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

  // Drawer de detalles / Hijos
  selected = signal<any | null>(null);

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName:  ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  ['', [Validators.required, Validators.minLength(6)]],
    phone:     ['', Validators.required],
    address:   [''],
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(p =>
      !q ||
      normalizeText(p.user?.firstName ?? '').includes(q) ||
      normalizeText(p.user?.lastName ?? '').includes(q) ||
      normalizeText(p.user?.email ?? '').includes(q) ||
      normalizeText(p.phone ?? '').includes(q) ||
      normalizeText(p.address ?? '').includes(q) ||
      p.children?.some((c: any) =>
        normalizeText(c.user?.firstName ?? '').includes(q) ||
        normalizeText(c.user?.lastName ?? '').includes(q) ||
        normalizeText(c.enrollmentId ?? '').includes(q)
      )
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/users/parents`).subscribe({
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

  openEdit(p: any) {
    this.editing.set(p);
    this.formError.set('');
    this.form.patchValue({
      firstName: p.user?.firstName ?? '',
      lastName:  p.user?.lastName ?? '',
      email:     p.user?.email ?? '',
      phone:     p.phone ?? '',
      address:   p.address ?? '',
      password:  '',
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
        phone: v.phone,
      };
      if (v.address) body.address = v.address;
      if (v.password) body.password = v.password;

      this.http.put(`${API}/users/${editing.user?.id}`, body).subscribe({
        next: () => this.afterSave('Tutor actualizado correctamente'),
        error: (err) => this.saveError(err)
      });
    } else {
      const body: any = {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        password: v.password,
        role: 'PARENT',
        phone: v.phone,
      };
      if (v.address) body.address = v.address;

      this.http.post(`${API}/users`, body).subscribe({
        next: () => this.afterSave('Tutor registrado correctamente'),
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
    this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar el tutor'));
  }

  remove(p: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar al tutor ${p.user?.firstName} ${p.user?.lastName}?`)) return;
    this.deleting.set(p.user?.id);
    this.http.delete(`${API}/users/${p.user?.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== p.id));
        this.showToast('Tutor eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar al tutor', false);
      }
    });
  }

  viewChildren(p: any) {
    this.selected.set(p);
  }
  closeDrawer() {
    this.selected.set(null);
  }

  initials(user: any): string {
    return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
