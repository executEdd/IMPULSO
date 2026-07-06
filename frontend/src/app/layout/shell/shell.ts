import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

const API = 'https://impulso-api.onrender.com/api';
interface NavItem {
  label: string;
  faIcon: string;
  route: string;

}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  private http = inject(HttpClient);

  collapsed = signal(false);

  unreadCount = signal(0);
  notifs      = signal<any[]>([]);
  notifOpen   = signal(false);
  notifLoading = signal(false);
  navGroups: NavGroup[] = [
    {
      label: 'General',
      items: [
        { label: 'Dashboard',  faIcon: 'fa-chart-pie',    route: '/dashboard' },
        { label: 'Alumnos',    faIcon: 'fa-user-graduate', route: '/alumnos'  },
      ]
    },
    {
      label: 'Académico',
      items: [
        { label: 'Asistencia',     faIcon: 'fa-list-check',        route: '/asistencia'     },
        { label: 'Calificaciones', faIcon: 'fa-star-half-stroke',  route: '/calificaciones' },
        { label: 'Horarios',       faIcon: 'fa-calendar-days',     route: '/horarios'       },
      ]
    },
    {
      label: 'Comunicación',
      items: [
        { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones' },
      ]
    }
  ];

  ngOnInit() {
    this.refreshUnread();
  }
  get initials(): string {
    const u = this.auth.user();
    return ((u?.firstName?.[0] ?? '') + (u?.lastName?.[0] ?? '')).toUpperCase();
  }

  toggle() { this.collapsed.update(v => !v); }
  refreshUnread() {
    this.http.get<number>(`${API}/notifications/unread-count`).subscribe({
      next: n => this.unreadCount.set(n ?? 0),
      error: () => {}
    });
  }

  toggleNotifs() {
    const opening = !this.notifOpen();
    this.notifOpen.set(opening);
    if (opening) {
      this.notifLoading.set(true);
      this.http.get<any[]>(`${API}/notifications/my-notifications`).subscribe({
        next: list => {
          this.notifs.set((list ?? []).slice(0, 8));
          this.notifLoading.set(false);
        },
        error: () => this.notifLoading.set(false)
      });
    }
  }

  markRead(n: any) {
    if (n.status === 'READ') return;
    this.http.put(`${API}/notifications/${n.id}/read`, {}).subscribe({
      next: () => {
        this.notifs.update(list =>
          list.map(x => x.id === n.id ? { ...x, status: 'READ' } : x));
        this.unreadCount.update(c => Math.max(0, c - 1));
      },
      error: () => {}
    });
  }

  closeNotifs() { this.notifOpen.set(false); }
}
