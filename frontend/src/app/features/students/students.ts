import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { API } from '../../core/config/api.config';
import { normalizeText } from '../../core/utils/text.utils';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './students.html',
  styleUrl: './students.css'
})
export class StudentsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading  = signal(true);
  all      = signal<any[]>([]);
  search   = signal('');

  // ── Drawer de perfil ──
  selected        = signal<any | null>(null);
  drawerLoading   = signal(false);
  stats           = signal<{ absences: number; totalClasses: number; attendanceRate: string } | null>(null);
  history         = signal<any[]>([]);
  studentGrades   = signal<any[]>([]);
  parentInfo      = signal<any | null>(null);
  parentsList     = signal<any[]>([]);
  assigningParent = signal(false);
  resetting       = signal(false);

  // ── Modal alta/edición ──
  modalOpen  = signal(false);
  editing    = signal<any | null>(null);
  saving     = signal(false);
  deleting   = signal<number | null>(null);
  formError  = signal('');

  toastMsg = signal('');
  toastOk  = signal(true);

  form = this.fb.group({
    studentFirstName: ['', Validators.required],
    studentLastName:  ['', Validators.required],
    studentEmail:     ['', [Validators.required, Validators.email]],
    enrollmentId:     ['', Validators.required],
    groupId:          [null as number | null, Validators.required],
    studentPhone:     [''],
    studentPassword:  [''],
    
    parentFirstName:  ['', Validators.required],
    parentLastName:   ['', Validators.required],
    parentPhone:      ['', Validators.required],
    parentEmail:      [''],
    parentAddress:    [''],
    parentPassword:   [''],
  });

  groupsList = signal<any[]>([]);
  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.all().filter(s =>
      !q ||
      normalizeText(s.user?.firstName ?? '').includes(q) ||
      normalizeText(s.user?.lastName ?? '').includes(q) ||
      normalizeText(s.enrollmentId ?? '').includes(q)
    );
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  ngOnInit() {
    this.fetchAll();
    this.loadGroups();
  }

  loadGroups() {
    this.http.get<any[]>(`${API}/groups`).subscribe(res => this.groupsList.set(res));
  }

  // --- BULK IMPORT LOGIC ---
  bulkImportOpen = signal(false);
  importFile = signal<File | null>(null);
  importLoading = signal(false);
  importResult = signal<any | null>(null);

  openBulkImport() {
    this.importFile.set(null);
    this.importResult.set(null);
    this.bulkImportOpen.set(true);
  }

  closeBulkImport() {
    this.bulkImportOpen.set(false);
    if (this.importResult()?.successful > 0) {
      this.fetchAll();
    }
  }

  isDragging = signal(false);

  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      if (files[0].name.endsWith('.csv') || files[0].type.includes('csv')) {
        this.importFile.set(files[0]);
      } else {
        this.showToast('Solo se permiten archivos .csv', false);
      }
    }
  }

  onFileChange(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.files?.length) {
      this.importFile.set(el.files[0]);
    }
  }

  removeFile() {
    this.importFile.set(null);
    this.importResult.set(null);
  }

  uploadCsv() {
    const file = this.importFile();
    if (!file) return;

    this.importLoading.set(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;
      
      const uint8Array = new Uint8Array(buffer);
      let text = '';
      
      // Detectar BOM (Byte Order Mark) de UTF-8
      if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
        text = new TextDecoder('utf-8').decode(uint8Array);
      } else {
        // Intentar decodificar como UTF-8
        text = new TextDecoder('utf-8').decode(uint8Array);
        // Si aparecen caracteres de reemplazo "", significa que Excel lo guardó en ANSI (Windows-1252)
        if (text.includes('')) {
          text = new TextDecoder('windows-1252').decode(uint8Array);
        }
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) {
        this.showToast('El archivo está vacío o sin datos válidos', false);
        this.importLoading.set(false);
        return;
      }

      // Diccionario de equivalencias para columnas amigables
      const headerMap: Record<string, string> = {
        'nombre alumno': 'studentFirstName',
        'apellidos alumno': 'studentLastName',
        'correo': 'studentEmail',
        'matricula': 'enrollmentId',
        'grupo': 'groupId',
        'telefono': 'studentPhone',
        'nombre tutor': 'parentFirstName',
        'apellidos tutor': 'parentLastName',
        'telefono tutor': 'parentPhone',
        'correo tutor': 'parentEmail',

        // Mantener soporte para los nombres internos (por si acaso)
        'studentfirstname': 'studentFirstName',
        'studentlastname': 'studentLastName',
        'studentemail': 'studentEmail',
        'enrollmentid': 'enrollmentId',
        'groupid': 'groupId',
        'studentphone': 'studentPhone',
        'parentfirstname': 'parentFirstName',
        'parentlastname': 'parentLastName',
        'parentphone': 'parentPhone',
        'parentemail': 'parentEmail'
      };

      const rawHeaders = lines[0].split(',').map(h => h.trim());
      // Mapear el header crudo a su llave interna en el backend
      const headers = rawHeaders.map(h => headerMap[h.toLowerCase()] || h);
      
      const payload: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((h, idx) => {
          if (vals[idx]) row[h] = h === 'groupId' ? Number(vals[idx]) : vals[idx];
        });
        if (row.studentFirstName) payload.push(row);
      }

      this.http.post(`${API}/students/bulk`, { students: payload }).subscribe({
        next: (res) => {
          this.importLoading.set(false);
          this.importResult.set(res);
        },
        error: (err) => {
          this.importLoading.set(false);
          
          const msg = err?.error?.message;
          // Si es un error de class-validator (Bad Request) con un arreglo de mensajes
          if (err?.status === 400 && Array.isArray(msg)) {
            const formattedErrors = msg.map(m => {
              const match = typeof m === 'string' ? m.match(/students\.(\d+)\.([a-zA-Z]+)(.*)/) : null;
              if (match) {
                const filaExcel = parseInt(match[1]) + 2; 
                let campo = match[2];
                // Diccionario para mostrar el nombre amigable
                const dicc: Record<string, string> = {
                  studentFirstName: 'Nombre Alumno', studentLastName: 'Apellidos Alumno',
                  studentEmail: 'Correo', enrollmentId: 'Matricula', groupId: 'Grupo',
                  studentPhone: 'Telefono', parentFirstName: 'Nombre Tutor',
                  parentLastName: 'Apellidos Tutor', parentPhone: 'Telefono Tutor',
                  parentEmail: 'Correo Tutor'
                };
                campo = dicc[campo] || campo;
                return `Fila Excel ${filaExcel}: Falta o es inválido el dato "${campo}"`;
              }
              return m;
            });
            
            // Eliminar mensajes duplicados de la misma celda
            const uniqueErrors = Array.from(new Set(formattedErrors));
            
            // Lo mostramos dentro del modal bonito
            this.importResult.set({
              successful: 0,
              failed: payload.length,
              errors: ['El archivo fue rechazado. Corrige los siguientes errores:', ...uniqueErrors]
            });
            
            this.showToast('El archivo contiene filas con datos incompletos.', false);
          } else {
            this.showToast('Error procesando CSV: ' + (typeof msg === 'string' ? msg : 'Error del servidor'), false);
          }
        }
      });
    };
    reader.readAsArrayBuffer(file);
  }

  exportCsv() {
    const data = this.all();
    if (!data.length) return;

    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows: string[] = [];
    rows.push('ID,Nombre,Apellidos,Correo,Matrícula,Grupo,Semáforo,Tutor,Correo Tutor');

    data.forEach(s => {
      const firstName = esc(s.user?.firstName ?? '');
      const lastName = esc(s.user?.lastName ?? '');
      const email = esc(s.user?.email ?? '');
      const enrollmentId = esc(s.enrollmentId ?? '');
      const groupName = esc(s.studentProfile?.group?.name ?? '');
      const semaphore = esc(s.studentProfile?.semaphore ?? 'GREEN');
      const parentName = esc(s.parent?.user ? `${s.parent.user.firstName ?? ''} ${s.parent.user.lastName ?? ''}`.trim() : '');
      const parentEmail = esc(s.parent?.user?.email ?? '');
      rows.push([s.id, firstName, lastName, email, enrollmentId, groupName, semaphore, parentName, parentEmail].join(','));
    });

    const encoder = new TextEncoder();
    const csvBytes = encoder.encode('\uFEFF' + rows.join('\n'));
    const blob = new Blob([csvBytes], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alumnos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  fetchAll() {
    this.loading.set(true);
    this.http.get<any[]>(`${API}/students`).subscribe({
      next: (students) => {
        this.all.set(students);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Perfil ──
  studentAiInsight = signal<any | null>(null);
  studentAiLoading = signal(false);

  fetchStudentAiInsight() {
    const s = this.selected();
    if (!s || this.studentAiLoading()) return;
    this.studentAiLoading.set(true);
    this.http.post<any>(`${API}/ai-insights/students/${s.id}`, {}).subscribe({
      next: (res) => {
        this.studentAiInsight.set(res);
        this.studentAiLoading.set(false);
      },
      error: () => this.studentAiLoading.set(false)
    });
  }

  openProfile(s: any) {
    this.selected.set(s);
    this.drawerLoading.set(true);
    this.stats.set(null);
    this.history.set([]);
    this.studentGrades.set([]);
    this.parentInfo.set(null);
    this.studentAiInsight.set(null);

    forkJoin({
      stats:      this.http.get<any>(`${API}/attendance/stats/student/${s.id}`).pipe(catchError(() => of(null))),
      history:    this.http.get<any[]>(`${API}/attendance/student/${s.id}`).pipe(catchError(() => of([]))),
      grades:     this.http.get<any[]>(`${API}/grades/student/${s.id}`).pipe(catchError(() => of([]))),
      parentInfo: this.http.get<any>(`${API}/users/students/${s.id}/parent-info`).pipe(catchError(() => of(null))),
      parents:    this.http.get<any[]>(`${API}/users/parents`).pipe(catchError(() => of([]))),
      insights:   this.http.get<any>(`${API}/insights/students/${s.id}`).pipe(catchError(() => of(null))),
    }).subscribe(({ stats, history, grades, parentInfo, parents, insights }) => {
      this.stats.set(stats);
      this.history.set((history ?? []).slice(0, 10));
      this.studentGrades.set(grades ?? []);
      this.parentInfo.set(parentInfo);
      this.parentsList.set(parents ?? []);
      if (insights) {
        this.studentAiInsight.set({
          summary: insights.recommendations?.[0] ?? 'Rendimiento académico regular.',
          strengths: insights.topSubject ? [`Desempeño destacado en ${insights.topSubject}`] : [],
          areasOfImprovement: insights.weakestSubject ? [`Atención prioritaria en ${insights.weakestSubject}`] : [],
          actionPlan: insights.riskFactors ?? [],
          source: 'local'
        });
      }
      this.drawerLoading.set(false);
    });
  }

  assignParent(parentIdStr: string) {
    const parentId = Number(parentIdStr);
    const s = this.selected();
    if (!s || !parentId || this.assigningParent()) return;

    this.assigningParent.set(true);
    this.http.put(`${API}/users/students/${s.id}/parent/${parentId}`, {}).subscribe({
      next: (res: any) => {
        this.assigningParent.set(false);
        this.parentInfo.set(res);
        this.showToast('Tutor asignado con éxito', true);
      },
      error: (err) => {
        this.assigningParent.set(false);
        this.showToast(err?.error?.message ?? 'Error al asignar tutor', false);
      }
    });
  }

  closeProfile() { this.selected.set(null); }

  resetSemaphore() {
    const s = this.selected();
    if (!s || this.resetting()) return;
    this.resetting.set(true);
    this.http.post(`${API}/attendance/semaphore/reset/${s.id}`, {}).subscribe({
      next: () => {
        this.resetting.set(false);
        this.selected.update(sel => sel ? { ...sel, semaphore: 'GREEN' } : sel);
        this.all.update(list => list.map(x => x.id === s.id ? { ...x, semaphore: 'GREEN' } : x));
        this.showToast('Semáforo restablecido a verde', true);
      },
      error: (err) => {
        this.resetting.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo restablecer el semáforo', false);
      }
    });
  }

  // ── CRUD ──
  openCreate() {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(s: any) {
    this.editing.set(s);
    this.formError.set('');
    // Currently API/students PUT is not implemented, but we populate form anyway
    this.form.patchValue({
      studentFirstName: s.user?.firstName ?? '',
      studentLastName:  s.user?.lastName ?? '',
      studentEmail:     s.user?.email ?? '',
      enrollmentId:     s.enrollmentId ?? '',
      groupId:          s.groupId ?? null,
      studentPhone:     s.phone ?? '',
      parentFirstName:  s.parent?.user?.firstName ?? '',
      parentLastName:   s.parent?.user?.lastName ?? '',
      parentPhone:      s.parent?.phone ?? '',
      parentEmail:      s.parent?.user?.email ?? '',
      parentAddress:    s.parent?.address ?? ''
    });
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
      // NOTE: PUT /students/:id is not implemented yet in the backend
      this.showToast('Actualización no soportada aún', false);
      this.saving.set(false);
    } else {
      const body = {
        studentFirstName: v.studentFirstName,
        studentLastName:  v.studentLastName,
        studentEmail:     v.studentEmail,
        enrollmentId:     v.enrollmentId,
        groupId:          Number(v.groupId),
        studentPhone:     v.studentPhone || undefined,
        studentPassword:  v.studentPassword || undefined,
        
        parentFirstName:  v.parentFirstName,
        parentLastName:   v.parentLastName,
        parentPhone:      v.parentPhone,
        parentEmail:      v.parentEmail || undefined,
        parentAddress:    v.parentAddress || undefined,
        parentPassword:   v.parentPassword || undefined
      };
      
      this.http.post(`${API}/students`, body).subscribe({
        next: () => this.afterSave('Alumno registrado exitosamente'),
        error: (err) => this.saveError(err)
      });
    }
  }

  private afterSave(msg: string) {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.showToast(msg, true);
    this.fetchAll();
  }

  private saveError(err: any) {
    this.saving.set(false);
    const m = err?.error?.message;
    this.formError.set(Array.isArray(m) ? m.join('. ') : (typeof m === 'string' ? m : 'Error al guardar'));
  }

  remove(s: any) {
    if (this.deleting()) return;
    if (!confirm(`¿Eliminar a ${s.user?.firstName} ${s.user?.lastName}? Esta acción no se puede deshacer.`)) return;
    this.deleting.set(s.id);
    this.http.delete(`${API}/students/${s.id}`).subscribe({
      next: () => {
        this.deleting.set(null);
        this.all.update(list => list.filter(x => x.id !== s.id));
        if (this.selected()?.id === s.id) this.closeProfile();
        this.showToast('Alumno eliminado', true);
      },
      error: (err) => {
        this.deleting.set(null);
        this.showToast(err?.error?.message ?? 'No se pudo eliminar', false);
      }
    });
  }

  // ── Helpers ──
  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }
  semColor(s: string) {
    return s === 'GREEN' ? 'chip-green' : s === 'YELLOW' ? 'chip-yellow' : 'chip-red';
  }
  semLabel(s: string) {
    return s === 'GREEN' ? 'Verde' : s === 'YELLOW' ? 'Amarillo' : 'Rojo';
  }
  initials(s: any) {
    return `${s.user?.firstName?.[0] ?? ''}${s.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
  attStatusChip(st: string) {
    const m: Record<string, string> = {
      PRESENT: 'chip-green', LATE: 'chip-yellow', ABSENT: 'chip-red', JUSTIFIED: 'chip-yellow'
    };
    return m[st] ?? 'chip-neutral';
  }
  attStatusLabel(st: string) {
    const m: Record<string, string> = {
      PRESENT: 'Presente', LATE: 'Tardanza', ABSENT: 'Ausente', JUSTIFIED: 'Justificado'
    };
    return m[st] ?? st;
  }
  gradeChip(val: number | null): string {
    if (val === null || val === undefined) return 'chip-neutral';
    if (val >= 9) return 'chip-green';
    if (val >= 7) return 'chip-yellow';
    return 'chip-red';
  }
}
