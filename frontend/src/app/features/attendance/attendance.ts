import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';

const API = 'https://impulso-api.onrender.com/api';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css'
})
export class AttendanceComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  records = signal<any[]>([]);

  ngOnInit() {
    this.http.get<any[]>(`${API}/attendance`).subscribe({
      next: data => { this.records.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  statusClass(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'chip-green', LATE: 'chip-yellow',
      ABSENT: 'chip-red', JUSTIFIED: 'chip-yellow'
    };
    return m[s] ?? 'chip-yellow';
  }
  statusLabel(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'Presente', LATE: 'Tardanza',
      ABSENT: 'Ausente', JUSTIFIED: 'Justificado'
    };
    return m[s] ?? s;
  }
  statusIcon(s: string) {
    const m: Record<string, string> = {
      PRESENT: 'fa-circle-check', LATE: 'fa-clock',
      ABSENT: 'fa-circle-xmark', JUSTIFIED: 'fa-file-circle-check'
    };
    return m[s] ?? 'fa-circle';
  }
  initials(r: any) {
    return `${r.student?.user?.firstName?.[0] ?? ''}${r.student?.user?.lastName?.[0] ?? ''}`.toUpperCase();
  }
}
