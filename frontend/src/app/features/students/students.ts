import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000/api';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [],
  templateUrl: './students.html',
  styleUrl: './students.css'
})
export class StudentsComponent implements OnInit {
  private http = inject(HttpClient);

  loading  = signal(true);
  all      = signal<any[]>([]);
  search   = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.all().filter(s =>
      !q ||
      s.user?.firstName?.toLowerCase().includes(q) ||
      s.user?.lastName?.toLowerCase().includes(q)  ||
      s.enrollmentId?.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.http.get<any[]>(`${API}/users`).subscribe({
      next: users => {
        const students = users
          .filter(u => u.role === 'STUDENT')
          .map(u => ({ ...u.studentProfile, user: u }));
        this.all.set(students);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
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
}
