import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  faIcon: string;
  route: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class ShellComponent {
  auth = inject(AuthService);
  collapsed = signal(false);

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
        { label: 'Asistencia',     faIcon: 'fa-qrcode',           route: '/asistencia'     },
        { label: 'Calificaciones', faIcon: 'fa-star-half-stroke',  route: '/calificaciones' },
        { label: 'Horarios',       faIcon: 'fa-calendar-days',     route: '/horarios'       },
      ]
    },
    {
      label: 'Comunicación',
      items: [
        { label: 'Notificaciones', faIcon: 'fa-bell', route: '/notificaciones', badge: 3 },
      ]
    }
  ];

  get initials(): string {
    const u = this.auth.user();
    return ((u?.firstName?.[0] ?? '') + (u?.lastName?.[0] ?? '')).toUpperCase();
  }

  toggle() { this.collapsed.update(v => !v); }
}
