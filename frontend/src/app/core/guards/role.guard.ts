import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de rol: protege rutas que solo pueden ver ciertos roles.
 * Uso en routes:  canActivate: [roleGuard('ADMIN','TEACHER')]
 */
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    const role   = auth.user()?.role ?? '';
    if (allowedRoles.includes(role)) return true;
    router.navigate(['/dashboard']);
    return false;
  };
}
