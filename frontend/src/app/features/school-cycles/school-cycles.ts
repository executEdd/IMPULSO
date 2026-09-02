import { Component, inject, signal, OnInit, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { API } from "../../core/config/api.config";
import { normalizeText } from "../../core/utils/text.utils";
import { DatePipe } from "@angular/common";


@Component({
  selector: "app-school-cycles",
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: "./school-cycles.html",
  styleUrl: "./school-cycles.css"
})
export class SchoolCyclesComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  cycles  = signal<any[]>([]);
  search  = signal("");

  modalOpen = signal(false);
  editId    = signal<number | null>(null);

  form = this.fb.group({
    name:      ["", Validators.required],
    startDate: ["", Validators.required],
    endDate:   ["", Validators.required],
    isActive:  [true]
  });

  filtered = computed(() => {
    const q = normalizeText(this.search());
    return this.cycles().filter(c => normalizeText(c.cycleName ?? '').includes(q));
  });

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    this.http.get<any[]>(`${API}/school-cycles`).subscribe({
      next: (res) => {
        this.cycles.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openModal(cycle?: any) {
    if (cycle) {
      this.editId.set(cycle.id);
      this.form.patchValue({
        name: cycle.cycleName,
        startDate: cycle.startDate?.split("T")[0],
        endDate: cycle.finishDate?.split("T")[0],
        isActive: cycle.isActive
      });
    } else {
      this.editId.set(null);
      this.form.reset({ isActive: true });
    }
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  save(addAnother = false) {
    if (this.form.invalid) return;
    const v = this.form.value;
    const payload = {
      cycleName: v.name,
      startDate: new Date(v.startDate!).toISOString(),
      finishDate: new Date(v.endDate!).toISOString(),
      isActive: !!v.isActive
    };

    const id = this.editId();
    if (id) {
      this.http.put(`${API}/school-cycles/${id}`, payload).subscribe(() => {
        this.closeModal();
        this.loadAll();
      });
    } else {
      this.http.post(`${API}/school-cycles`, payload).subscribe(() => {
        if (addAnother) {
           this.form.reset({ isActive: true });
           this.loadAll(); // Cargar en background
        } else {
           this.closeModal();
           this.loadAll();
        }
      });
    }
  }

  deleteCycle(id: number) {
    if (!confirm("¿Eliminar ciclo escolar?")) return;
    this.http.delete(`${API}/school-cycles/${id}`).subscribe(() => this.loadAll());
  }
}

