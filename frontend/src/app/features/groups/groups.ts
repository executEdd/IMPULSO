import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './groups.html',
  styleUrl: './groups.css'
})
export class GroupsComponent implements OnInit {
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

  grades = [1, 2, 3, 4, 5, 6];

  form = this.fb.group({
    name:       ['', Validators.required],
    gradeLevel: [1, [Validators.required, Validators.min(1), Validators.max(6)]],
    career:     ['', Validators.required],
  });

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(g =>
      !q ||
      g.name?.toLowerCase().includes(q) ||
      g.career?.toLowerCase().includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/groups`).subscribe({
      next: data => { this.all.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ name: '', gradeLevel: 1, career: '' });
    this.modalOpen.set(true);
  }

  openEdit(g: any) {
    this.editing.set(g);
    this.formError.set('');
    this.form.patchValue({ name: g.name, gradeLevel: g.gradeLevel, career: g.career });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const body = {
      name: this.form.value.name,
      gradeLevel: Number(this.form.value.gradeLevel),
      career: this.form.value.career,
    };
    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/groups/${editing.id}`, body)
      : this.http.post(`${API}/groups`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(editing ? 'Grupo actualizado' : 'Grupo creado', true);
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

  remove(g: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar el grupo "${g.name}"?`)) return;
    this.deleting.set(g.id);
    this.http.delete(`${API}/groups/${g.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== g.id));
        this.showToast('Grupo eliminado', true);
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

  studentCount(g: any): number {
    return g._count?.students ?? g.students?.length ?? 0;
  }
}
