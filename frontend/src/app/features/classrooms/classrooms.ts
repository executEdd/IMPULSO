import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';

@Component({
  selector: 'app-classrooms',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './classrooms.html',
  styleUrl: './classrooms.css'
})
export class ClassroomsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  all     = signal<any[]>([]);
  search  = signal('');

  modalOpen = signal(false);
  editing   = signal<any | null>(null);
  saving    = signal(false);
  deleting  = signal<number | null>(null);
  formError = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    name:        ['', Validators.required],
    capacity:    [30, [Validators.min(1)]],
    description: [''],
  });

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(c =>
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  });

  totalCapacity = computed(() => {
    return this.all().reduce((sum, c) => sum + (c.capacity || 0), 0);
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/classrooms`).subscribe({
      next: data => { this.all.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ name: '', capacity: 30, description: '' });
    this.modalOpen.set(true);
  }

  openEdit(c: any) {
    this.editing.set(c);
    this.formError.set('');
    this.form.patchValue({
      name: c.name,
      capacity: c.capacity ?? 30,
      description: c.description ?? ''
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const val = this.form.value;
    const body: any = {
      name: val.name,
      capacity: val.capacity ? Number(val.capacity) : undefined,
      description: val.description || undefined
    };
    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/classrooms/${editing.id}`, body)
      : this.http.post(`${API}/classrooms`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(editing ? 'Salón actualizado' : 'Salón registrado', true);
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

  remove(c: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar el salón "${c.name}"?`)) return;
    this.deleting.set(c.id);
    this.http.delete(`${API}/classrooms/${c.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== c.id));
        this.showToast('Salón eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar el salón', false);
      }
    });
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
