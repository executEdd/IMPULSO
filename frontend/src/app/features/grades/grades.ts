import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000/api';

@Component({
  selector: 'app-grades',
  standalone: true,
  imports: [],
  templateUrl: './grades.html',
  styleUrl: './grades.css'
})
export class GradesComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  all     = signal<any[]>([]);
  search  = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(g =>
      !q ||
      g.student?.user?.firstName?.toLowerCase().includes(q) ||
      g.student?.user?.lastName?.toLowerCase().includes(q)  ||
      g.subject?.name?.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.http.get<any[]>(`${API}/grades`).subscribe({
      next: data => { this.all.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
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
