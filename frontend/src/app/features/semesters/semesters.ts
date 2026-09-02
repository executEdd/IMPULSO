import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-semesters',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './semesters.html',
  styleUrl: './semesters.css'
})
export class SemestersComponent implements OnInit {
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
    semesterName:  ['', Validators.required],
    startDate:     ['', Validators.required],
    finishDate:    ['', Validators.required],
    schoolCycleId: [1, [Validators.required, Validators.min(1)]],
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(s =>
      !q ||
      normalizeText(s.semesterName ?? '').includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() { this.fetchAll(); }

  fetchAll() {
    this.http.get<any[]>(`${API}/semesters`).subscribe({
      next: data => { this.all.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    const today = new Date().toISOString().split('T')[0];
    this.form.reset({
      semesterName: '',
      startDate: today,
      finishDate: today,
      schoolCycleId: 1
    });
    this.modalOpen.set(true);
  }

  openEdit(s: any) {
    this.editing.set(s);
    this.formError.set('');
    const startStr = s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '';
    const finishStr = s.finishDate ? new Date(s.finishDate).toISOString().split('T')[0] : '';

    this.form.patchValue({
      semesterName: s.semesterName,
      startDate: startStr,
      finishDate: finishStr,
      schoolCycleId: s.schoolCycleId ?? 1
    });
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const val = this.form.value;

    const body = {
      semesterName: val.semesterName,
      startDate: new Date(val.startDate!).toISOString(),
      finishDate: new Date(val.finishDate!).toISOString(),
      schoolCycleId: Number(val.schoolCycleId)
    };

    const editing = this.editing();
    const req = editing
      ? this.http.put(`${API}/semesters/${editing.id}`, body)
      : this.http.post(`${API}/semesters`, body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.showToast(editing ? 'Semestre actualizado' : 'Semestre registrado', true);
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

  remove(s: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar el semestre "${s.semesterName}"?`)) return;
    this.deleting.set(s.id);
    this.http.delete(`${API}/semesters/${s.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== s.id));
        this.showToast('Semestre eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar el semestre', false);
      }
    });
  }

  getStatusBadge(s: any): { label: string; class: string } {
    const now = new Date();
    const start = new Date(s.startDate);
    const finish = new Date(s.finishDate);

    if (now >= start && now <= finish) {
      return { label: 'Activo', class: 'chip-green' };
    } else if (now < start) {
      return { label: 'Próximo', class: 'chip-yellow' };
    } else {
      return { label: 'Concluido', class: 'chip-gray' };
    }
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
}
