import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

import { API } from '../../core/config/api.config';
interface NavItem {
  label: string;
  faIcon: string;
  route: string;
  roles?: ('ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT')[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: ('ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT')[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class ShellComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private pollingTimer: any;

  collapsed = signal(false);

  unreadCount = signal(0);
  notifs      = signal<any[]>([]);
  notifOpen   = signal(false);
  notifLoading = signal(false);

  visibleGroups = computed(() => {
    const role = this.auth.user()?.role || 'STUDENT';

    const isStudent = role === 'STUDENT';
    const isParent  = role === 'PARENT';
    const isTeacher = role === 'TEACHER';
    const isAdmin   = role === 'ADMIN';

    // ── PADRE: solo Dashboard, Calificaciones, Horarios, Notificaciones ──
    if (isParent) {
      return [
        {
          label: 'General',
          items: [
            { label: 'Dashboard', faIcon: 'fa-chart-pie', route: '/dashboard' }
          ]
        },
        {
          label: 'Académico',
          items: [
            { label: 'Calificaciones', faIcon: 'fa-star-half-stroke', route: '/calificaciones' },
            { label: 'Horarios',       faIcon: 'fa-calendar-days',    route: '/horarios'       },
          ]
        },
        {
          label: 'Comunicación',
          items: [
            { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones' }
          ]
        }
      ] as NavGroup[];
    }

    // ── ALUMNO: Dashboard, Mi QR, Asistencia, Calificaciones, Horarios, Notificaciones ──
    if (isStudent) {
      return [
        {
          label: 'General',
          items: [
            { label: 'Dashboard', faIcon: 'fa-chart-pie', route: '/dashboard' },
            { label: 'Mi QR',     faIcon: 'fa-qrcode',   route: '/mi-qr'     }
          ]
        },
        {
          label: 'Académico',
          items: [
            { label: 'Asistencia',     faIcon: 'fa-list-check',       route: '/asistencia'     },
            { label: 'Calificaciones', faIcon: 'fa-star-half-stroke', route: '/calificaciones' },
            { label: 'Horarios',       faIcon: 'fa-calendar-days',    route: '/horarios'       },
          ]
        },
        {
          label: 'Comunicación',
          items: [
            { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones' }
          ]
        }
      ] as NavGroup[];
    }

    // ── DOCENTE: Dashboard, Alumnos, Asistencia, Calificaciones, Horarios, Clases, Notificaciones ──
    if (isTeacher) {
      return [
        {
          label: 'General',
          items: [
            { label: 'Dashboard', faIcon: 'fa-chart-pie',     route: '/dashboard' },
            { label: 'Alumnos',   faIcon: 'fa-user-graduate', route: '/alumnos'   }
          ]
        },
        {
          label: 'Académico',
          items: [
            { label: 'Asistencia',     faIcon: 'fa-list-check',       route: '/asistencia'     },
            { label: 'Calificaciones', faIcon: 'fa-star-half-stroke', route: '/calificaciones' },
            { label: 'Horarios',       faIcon: 'fa-calendar-days',    route: '/horarios'       },
            { label: 'Clases',         faIcon: 'fa-school',           route: '/clases'         },
          ]
        },
        {
          label: 'Comunicación',
          items: [
            { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones' }
          ]
        }
      ] as NavGroup[];
    }

    // ── ADMIN: todo ──
    return [
      {
        label: 'General',
        items: [
          { label: 'Dashboard', faIcon: 'fa-chart-pie',     route: '/dashboard' },
          { label: 'Alumnos',   faIcon: 'fa-user-graduate', route: '/alumnos'   }
        ]
      },
      {
        label: 'Académico',
        items: [
          { label: 'Asistencia',     faIcon: 'fa-list-check',       route: '/asistencia'     },
          { label: 'Calificaciones', faIcon: 'fa-star-half-stroke', route: '/calificaciones' },
          { label: 'Horarios',       faIcon: 'fa-calendar-days',    route: '/horarios'       },
        ]
      },
      {
        label: 'Administración',
        items: [
          { label: 'Docentes',  faIcon: 'fa-chalkboard-user', route: '/docentes'  },
          { label: 'Tutores',   faIcon: 'fa-users',           route: '/tutores'   },
          { label: 'Grupos',    faIcon: 'fa-users-line',      route: '/grupos'    },
          { label: 'Materias',  faIcon: 'fa-book',            route: '/materias'  },
          { label: 'Clases',    faIcon: 'fa-school',          route: '/clases'    },
          { label: 'Aulas',     faIcon: 'fa-door-open',       route: '/aulas'     },
          { label: 'Semestres', faIcon: 'fa-calendar-days',   route: '/semestres' },
          { label: 'Ciclos',    faIcon: 'fa-calendar',        route: '/ciclos-escolares' },
        ]
      },
      {
        label: 'Comunicación',
        items: [
          { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones' }
        ]
      }
    ] as NavGroup[];
  });


  get roleLabel(): string {
    const r = this.auth.user()?.role;
    switch (r) {
      case 'ADMIN': return 'ADMIN';
      case 'TEACHER': return 'DOCENTE';
      case 'STUDENT': return 'ALUMNO';
      case 'PARENT': return 'PADRE / TUTOR';
      default: return '';
    }
  }

  ngOnInit() {
    this.refreshUnread();
    this.pollingTimer = setInterval(() => this.refreshUnread(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.pollingTimer);
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
