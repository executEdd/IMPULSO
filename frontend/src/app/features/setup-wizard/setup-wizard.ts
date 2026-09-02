import { Component, inject, signal, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { API } from "../../core/config/api.config";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-setup-wizard",
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: "./setup-wizard.html",
  styleUrl: "./setup-wizard.css"
})
export class SetupWizardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  currentStep = signal(1);
  loading = signal(false);
  
  // Created entity IDs to pass to the final step
  cycleId = signal<number | null>(null);
  semesterId = signal<number | null>(null);
  classroomId = signal<number | null>(null);
  groupId = signal<number | null>(null);
  subjectId = signal<number | null>(null);

  // Forms for each step
  cycleForm = this.fb.group({
    name: ["", Validators.required],
    startDate: ["", Validators.required],
    endDate: ["", Validators.required],
    isActive: [true]
  });

  semesterForm = this.fb.group({
    semesterName: ["", Validators.required],
    startDate: ["", Validators.required],
    finishDate: ["", Validators.required]
  });

  classroomForm = this.fb.group({
    name: ["", Validators.required],
    capacity: [30, [Validators.required, Validators.min(1)]],
    description: [""]
  });

  groupForm = this.fb.group({
    name: ["", Validators.required],
    gradeLevel: [1, [Validators.required, Validators.min(1)]],
    career: ["", Validators.required]
  });

  subjectForm = this.fb.group({
    name: ["", Validators.required],
    code: ["", Validators.required],
    description: [""],
    credits: [10, Validators.required]
  });

  // Final step form
  classForm = this.fb.group({
    teacherId: [null as number | null, Validators.required],
    schoolCycleId: [null as number | null, Validators.required],
    semesterId: [null as number | null, Validators.required],
    classroomId: [null as number | null, Validators.required],
    groupId: [null as number | null, Validators.required],
    subjectId: [null as number | null, Validators.required]
  });

  // Catalogs for final step (in case they skipped and need to select existing)
  teachers = signal<any[]>([]);
  cycles = signal<any[]>([]);
  semesters = signal<any[]>([]);
  classrooms = signal<any[]>([]);
  groups = signal<any[]>([]);
  subjects = signal<any[]>([]);

  ngOnInit() {
    this.loadCatalogs();
  }

  loadCatalogs() {
    this.http.get<any[]>(`${API}/users/teachers`).subscribe(res => this.teachers.set(res));
    this.http.get<any[]>(`${API}/school-cycles`).subscribe(res => this.cycles.set(res));
    this.http.get<any[]>(`${API}/semesters`).subscribe(res => this.semesters.set(res));
    this.http.get<any[]>(`${API}/classrooms`).subscribe(res => this.classrooms.set(res));
    this.http.get<any[]>(`${API}/groups`).subscribe(res => this.groups.set(res));
    this.http.get<any[]>(`${API}/subjects`).subscribe(res => this.subjects.set(res));
  }

  nextStep() {
    this.currentStep.update(s => Math.min(6, s + 1));
  }

  prevStep() {
    this.currentStep.update(s => Math.max(1, s - 1));
  }

  skipStep() {
    this.nextStep();
  }

  createCycle() {
    if (this.cycleForm.invalid) return;
    this.loading.set(true);
    const val = this.cycleForm.value;
    const payload = {
      name: val.name,
      startDate: new Date(val.startDate!).toISOString(),
      endDate: new Date(val.endDate!).toISOString(),
      isActive: val.isActive
    };
    this.http.post<any>(`${API}/school-cycles`, payload).subscribe({
      next: (res) => {
        this.cycleId.set(res.id);
        this.cycles.update(c => [...c, res]); // Update catalog
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  createSemester() {
    if (this.semesterForm.invalid) return;
    if (!this.cycleId() && this.cycles().length > 0) {
      // If skipped cycle creation, use the first available cycle for simplicity, or force selection
      this.cycleId.set(this.cycles()[this.cycles().length - 1].id);
    }
    
    this.loading.set(true);
    const val = this.semesterForm.value;
    const payload = {
      semesterName: val.semesterName,
      startDate: new Date(val.startDate!).toISOString(),
      finishDate: new Date(val.finishDate!).toISOString(),
      schoolCycleId: this.cycleId()
    };
    this.http.post<any>(`${API}/semesters`, payload).subscribe({
      next: (res) => {
        this.semesterId.set(res.id);
        this.semesters.update(c => [...c, res]);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  createClassroom() {
    if (this.classroomForm.invalid) return;
    this.loading.set(true);
    this.http.post<any>(`${API}/classrooms`, this.classroomForm.value).subscribe({
      next: (res) => {
        this.classroomId.set(res.id);
        this.classrooms.update(c => [...c, res]);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  createGroup() {
    if (this.groupForm.invalid) return;
    this.loading.set(true);
    this.http.post<any>(`${API}/groups`, this.groupForm.value).subscribe({
      next: (res) => {
        this.groupId.set(res.id);
        this.groups.update(c => [...c, res]);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  createSubject() {
    if (this.subjectForm.invalid) return;
    this.loading.set(true);
    this.http.post<any>(`${API}/subjects`, this.subjectForm.value).subscribe({
      next: (res) => {
        this.subjectId.set(res.id);
        this.subjects.update(c => [...c, res]);
        this.loading.set(false);
        this.prepareFinalStep();
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  prepareFinalStep() {
    this.classForm.patchValue({
      schoolCycleId: this.cycleId(),
      semesterId: this.semesterId(),
      classroomId: this.classroomId(),
      groupId: this.groupId(),
      subjectId: this.subjectId()
    });
  }

  finish() {
    if (this.classForm.invalid) return;
    this.loading.set(true);
    const v = this.classForm.value;
    
    // Class expects: subjectId, groupId, teacherId, semesterId, classroomId
    const payload = {
      subjectId: Number(v.subjectId),
      groupId: Number(v.groupId),
      teacherId: Number(v.teacherId),
      semesterId: Number(v.semesterId),
      classroomId: Number(v.classroomId)
    };

    this.http.post(`${API}/classes`, payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(["/clases"]);
      },
      error: () => this.loading.set(false)
    });
  }
}

