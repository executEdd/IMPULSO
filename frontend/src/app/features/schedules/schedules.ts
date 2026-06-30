import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'https://impulso-api.onrender.com/api';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado'
};
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAY_COLORS: Record<string, string> = {
  MONDAY: '#3B82F6', TUESDAY: '#8B5CF6', WEDNESDAY: '#10B981',
  THURSDAY: '#F59E0B', FRIDAY: '#7C1D2E', SATURDAY: '#6B7280'
};

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css'
})
export class SchedulesComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(true);
  byDay   = signal<{ day: string; label: string; color: string; items: any[] }[]>([]);

  ngOnInit() {
    this.http.get<any[]>(`${API}/schedules`).subscribe({
      next: data => {
        const grouped: Record<string, any[]> = {};
        for (const s of data) {
          const d = s.dayOfWeek;
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(s);
        }
        this.byDay.set(
          DAY_ORDER
            .filter(d => grouped[d]?.length)
            .map(d => ({
              day: d,
              label: DAY_LABELS[d] ?? d,
              color: DAY_COLORS[d] ?? '#6B7280',
              items: grouped[d].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
            }))
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
