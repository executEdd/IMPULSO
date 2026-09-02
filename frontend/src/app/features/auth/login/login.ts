import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private fb     = inject(FormBuilder);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false]
  });

  loading  = signal(false);
  errorMsg = signal('');
  showPass = signal(false);

  fillRole(role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT') {
    const creds = {
      ADMIN:   { email: 'subdirector@cbtis61.edu.mx', password: 'admin123' },
      TEACHER: { email: 'juan.perez@cbtis61.edu.mx',  password: 'teacher123' },
      STUDENT: { email: 'alumno1@cbtis61.edu.mx',     password: 'student123' },
      PARENT:  { email: 'padre1@email.com',            password: 'parent123' }
    };
    const c = creds[role];
    this.form.patchValue({ email: c.email, password: c.password, rememberMe: false });
    this.submit();
  }

  submit() {
    if (this.form.invalid || this.loading()) return;
    this.errorMsg.set('');
    this.loading.set(true);

    const { email, password, rememberMe } = this.form.value;
    this.auth.login({ email: email!, password: password!, rememberMe: !!rememberMe } as any).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(this.parseError(err));
      }
    });
  }

  /** NestJS puede devolver message como string, arreglo u objeto */
  private parseError(err: any): string {
    if (err?.status === 0) return 'Sin conexión con el servidor. Intenta más tarde.';
    const msg = err?.error?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join('. ');
    if (err?.status === 401) return 'Correo o contraseña incorrectos';
    return 'Credenciales incorrectas';
  }
}
