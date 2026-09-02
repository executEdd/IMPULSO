import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-grades',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './grades.html',
  styleUrl: './grades.css'
})
export class GradesComponent implements OnInit {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  loading = signal(true);
  all     = signal<any[]>([]);
  search  = signal('');
  activeTab = signal<'list' | 'grid' | 'logs'>('grid');

  // logs (auditoría, solo admin)
  logs        = signal<any[]>([]);
  logsLoading = signal(false);
  logsLoaded  = false;

  // catálogos derivados
  students = signal<any[]>([]);
  subjects = signal<any[]>([]);
  groups   = signal<any[]>([]);

  // Estado Sábana (Grid)
  gridGroup = signal<number | null>(null);
  gridSubject = signal<number | null>(null);
  gridPeriod = signal<string>('2025-2026A');
  gridData = signal<any[]>([]);
  saving = signal(false);

  toastMsg = signal('');
  toastOk  = signal(true);

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(g =>
      !q ||
      normalizeText(g.student?.user?.firstName ?? '').includes(q) ||
      normalizeText(g.student?.user?.lastName ?? '').includes(q) ||
      normalizeText(g.subject?.name ?? '').includes(q)
    );
  });

  get isAdmin()   { return this.auth.user()?.role === 'ADMIN'; }
  get isTeacher() { return this.auth.user()?.role === 'TEACHER'; }
  get isStudent() { return this.auth.user()?.role === 'STUDENT'; }
  get isParent()  { return this.auth.user()?.role === 'PARENT'; }
  get canEdit()   { const r = this.auth.user()?.role; return r === 'ADMIN' || r === 'TEACHER'; }

  get pageTitle(): string {
    if (this.isStudent) return 'Mis Calificaciones';
    if (this.isParent)  return 'Boleta de mi Hijo/a';
    if (this.isTeacher) return 'Calificaciones';
    return 'Calificaciones';
  }
  get pageSubtitle(): string {
    if (this.isStudent) return 'Consulta tus parciales y promedio por materia';
    if (this.isParent)  return 'Revisa el desempeño académico de tu hijo/a por materia y parcial';
    if (this.isTeacher) return 'Captura en formato sábana por grupo y materia';
    return 'Consulta y captura masiva de calificaciones';
  }

  ngOnInit() {
    this.fetchGrades();
    if (this.canEdit) {
      this.http.get<any[]>(`${API}/users`).subscribe({
        next: users => {
          this.students.set(
            users.filter(u => u.role === 'STUDENT' && u.studentProfile)
                 .map(u => ({ 
                   id: u.studentProfile.id, 
                   name: `${u.firstName} ${u.lastName}`,
                   groupId: u.studentProfile.groupId,
                   groupName: u.studentProfile.group?.name
                 }))
          );
          const grps = new Map<number, any>();
          this.students().forEach(s => {
            if (s.groupId && !grps.has(s.groupId)) {
              grps.set(s.groupId, { id: s.groupId, name: s.groupName });
            }
          });
          this.groups.set(Array.from(grps.values()));
        }
      });
      this.http.get<any[]>(`${API}/subjects`).subscribe({
        next: subjects => this.subjects.set(subjects)
      });
    } else {
      this.activeTab.set('list');
    }
  }

  exportCsv() {
    const data = this.filtered();
    if (!data.length) return;

    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows: string[] = [];
    rows.push('ID,Alumno,Matrícula,Grupo,Materia,Periodo,Parcial 1,Parcial 2,Parcial 3,Final,Estatus');

    data.forEach(g => {
      const studentName = esc(`${g.student?.user?.firstName ?? ''} ${g.student?.user?.lastName ?? ''}`.trim());
      const enrollmentId = esc(g.student?.enrollmentId ?? '');
      const groupName = esc(g.student?.group?.name ?? '');
      const subjectName = esc(g.subject?.name ?? '');
      const period = esc(g.period ?? '');
      const p1 = g.partial1 ?? '';
      const p2 = g.partial2 ?? '';
      const p3 = g.partial3 ?? '';
      const final_ = g.finalGrade ?? '';
      const status = esc(g.status ?? '');
      rows.push([g.id, studentName, enrollmentId, groupName, subjectName, period, p1, p2, p3, final_, status].join(','));
    });

    const encoder = new TextEncoder();
    const csvBytes = encoder.encode('\uFEFF' + rows.join('\n'));
    const blob = new Blob([csvBytes], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calificaciones_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  fetchGrades() {
    const user = this.auth.user();
    let url = `${API}/grades`;
    if (this.isStudent) {
      const studentId = user?.studentProfile?.id;
      if (studentId) url = `${API}/grades/student/${studentId}`;
    } else if (this.isParent) {
      const childId = user?.parentProfile?.children?.[0]?.id;
      if (childId) url = `${API}/grades/student/${childId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: data => {
        this.all.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
        if (this.canEdit) this.loadGrid();
      },
      error: () => this.loading.set(false)
    });
  }

  showLogs() {
    this.activeTab.set('logs');
    if (this.logsLoaded) return;
    this.logsLoading.set(true);
    this.http.get<any[]>(`${API}/grades/logs/all`).subscribe({
      next: data => {
        this.logs.set(data ?? []);
        this.logsLoaded = true;
        this.logsLoading.set(false);
      },
      error: () => this.logsLoading.set(false)
    });
  }

  loadGrid() {
    const gId = this.gridGroup();
    const subId = this.gridSubject();
    const period = this.gridPeriod();
    
    if (!gId || !subId || !period) {
      this.gridData.set([]);
      return;
    }

    const st = this.students().filter(s => s.groupId === gId);
    const data = st.map(s => {
      const existing = this.all().find(r => r.studentId === s.id && r.subjectId === subId && r.period === period);
      return {
        studentId: s.id,
        name: s.name,
        partial1: existing?.partial1 ?? null,
        partial2: existing?.partial2 ?? null,
        partial3: existing?.partial3 ?? null,
        finalGrade: existing?.finalGrade ?? null
      };
    });
    this.gridData.set(data);
  }

  saveGrid() {
    const subId = this.gridSubject();
    const period = this.gridPeriod();
    if (!subId || !period) return;
    
    this.saving.set(true);
    const payload = {
      subjectId: subId,
      period,
      grades: this.gridData().map(row => ({
        studentId: row.studentId,
        partial1: (row.partial1 !== '' && row.partial1 !== null) ? Number(row.partial1) : undefined,
        partial2: (row.partial2 !== '' && row.partial2 !== null) ? Number(row.partial2) : undefined,
        partial3: (row.partial3 !== '' && row.partial3 !== null) ? Number(row.partial3) : undefined
      }))
    };
    
    this.http.post(`${API}/grades/bulk`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast('Calificaciones guardadas', true);
        this.fetchGrades();
      },
      error: (err) => {
        this.saving.set(false);
        this.showToast('Error al guardar', false);
      }
    });
  }

  // ── Helper Toasts & UI ──
  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
  
  gradeChip(val: number | null): string {
    if (val === null || val === undefined) return 'chip-neutral';
    if (val >= 9) return 'chip-green';
    if (val >= 7) return 'chip-yellow';
    return 'chip-red';
  }

  statusClass(s: string) {
    const m: Record<string, string> = {
      EXCELLENT: 'chip-green', REGULAR: 'chip-yellow', IRREGULAR: 'chip-red'
    };
    return m[s] ?? 'chip-yellow';
  }
  
  statusLabel(s: string) {
    const m: Record<string, string> = {
      EXCELLENT: 'Excelente', REGULAR: 'Regular', IRREGULAR: 'Irregular'
    };
    return m[s] ?? s;
  }
  
  initials(g: any) {
    return `${g.student?.user?.firstName?.[0] ?? ''}${g.student?.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
}
