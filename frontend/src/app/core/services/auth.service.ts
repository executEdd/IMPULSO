import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse, LoginPayload, User } from '../models/user.model';

const API = (import.meta as any).env.NG_APP_API_URL;
const TOKEN_KEY = 'impulso_token';
const USER_KEY  = 'impulso_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user  = signal<User | null>(this._loadUser());

  readonly token    = this._token.asReadonly();
  readonly user     = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly fullName   = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  login(payload: LoginPayload) {
    return this.http.post<AuthResponse>(`${API}/auth/login`, payload).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.accessToken);
        this._user.set(res.user);
      })
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private _loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
