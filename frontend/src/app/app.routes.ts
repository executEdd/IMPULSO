import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
        // Solo ADMIN y TEACHER ven la lista completa de alumnos
        path: 'alumnos',
        canActivate: [roleGuard('ADMIN', 'TEACHER')],
        loadComponent: () => import('./features/students/students').then(m => m.StudentsComponent)
      },
      {
        // Solo STUDENT ve su propio QR
        path: 'mi-qr',
        canActivate: [roleGuard('STUDENT')],
        loadComponent: () => import('./features/my-qr/my-qr').then(m => m.MyQrComponent)
      },
      {
        // Asistencia: ADMIN, TEACHER, STUDENT, PARENT
        path: 'asistencia',
        canActivate: [roleGuard('ADMIN', 'TEACHER', 'STUDENT', 'PARENT')],
        loadComponent: () => import('./features/attendance/attendance').then(m => m.AttendanceComponent)
      },
      {
        // Calificaciones: todos
        path: 'calificaciones',
        canActivate: [roleGuard('ADMIN', 'TEACHER', 'STUDENT', 'PARENT')],
        loadComponent: () => import('./features/grades/grades').then(m => m.GradesComponent)
      },
      {
        path: 'horarios',
        canActivate: [roleGuard('ADMIN', 'TEACHER', 'STUDENT', 'PARENT')],
        loadComponent: () => import('./features/schedules/schedules').then(m => m.SchedulesComponent)
      },
      {
        path: 'notificaciones',
        loadComponent: () => import('./features/notifications/notifications').then(m => m.NotificationsComponent)
      },
      {
        // Grupos: solo ADMIN
        path: 'grupos',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/groups/groups').then(m => m.GroupsComponent)
      },
      {
        // Materias: solo ADMIN
        path: 'materias',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/subjects/subjects').then(m => m.SubjectsComponent)
      },
      {
        // Clases: ADMIN y TEACHER
        path: 'clases',
        canActivate: [roleGuard('ADMIN', 'TEACHER')],
        loadComponent: () => import('./features/classes/classes').then(m => m.ClassesComponent)
      },
      {
        // Docentes: solo ADMIN
        path: 'docentes',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/teachers/teachers').then(m => m.TeachersComponent)
      },
      {
        // Tutores: solo ADMIN
        path: 'tutores',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/parents/parents').then(m => m.ParentsComponent)
      },
      {
        // Aulas / Salones: solo ADMIN
        path: 'aulas',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/classrooms/classrooms').then(m => m.ClassroomsComponent)
      },
      {
        // Semestres: solo ADMIN
        path: 'semestres',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/semesters/semesters').then(m => m.SemestersComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
