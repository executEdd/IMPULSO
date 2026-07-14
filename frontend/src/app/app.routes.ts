import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'alumnos',
        loadComponent: () => import('./features/students/students').then(m => m.StudentsComponent)
      },
      {
        path: 'asistencia',
        loadComponent: () => import('./features/attendance/attendance').then(m => m.AttendanceComponent)
      },
      {
        path: 'calificaciones',
        loadComponent: () => import('./features/grades/grades').then(m => m.GradesComponent)
      },
      {
        path: 'horarios',
        loadComponent: () => import('./features/schedules/schedules').then(m => m.SchedulesComponent)
      },
      {
        path: 'materias',
        loadComponent: () => import('./features/subjects/subjects').then(m => m.SubjectsComponent)
      },
      {
        path: 'notificaciones',
        loadComponent: () => import('./features/notifications/notifications').then(m => m.NotificationsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
