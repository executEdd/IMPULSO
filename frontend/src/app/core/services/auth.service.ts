import { Injectable, inject, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { tap } from "rxjs/operators";
import { AuthResponse, LoginPayload, User } from "../models/user.model";

import { API } from "../config/api.config";
const USER_KEY  = "impulso_user";

@Injectable({ providedIn: "root" })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _user  = signal<User | null>(this._loadUser());

  readonly user     = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly fullName   = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : "";
  });

  constructor() {
    this.fetchProfile();
  }

  fetchProfile() {
    this.http.get<User>(`${API}/auth/profile`).subscribe({
      next: fullUser => {
        if (fullUser && fullUser.id) {
          localStorage.setItem(USER_KEY, JSON.stringify(fullUser));
          this._user.set(fullUser);
        }
      },
      error: () => {
        this.clearLocalSession();
      }
    });
  }

  login(payload: LoginPayload) {
    return this.http.post<AuthResponse>(`${API}/auth/login`, payload).pipe(
      tap(res => {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._user.set(res.user);
        this.fetchProfile();
      })
    );
  }

  logout() {
    this.http.post(`${API}/auth/logout`, {}).subscribe({
      next: () => this.clearLocalSession(),
      error: () => this.clearLocalSession()
    });
  }

  private clearLocalSession() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("impulso_token"); // Para limpiar tokens de versiones anteriores
    this._user.set(null);
    this.router.navigate(["/login"]);
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

