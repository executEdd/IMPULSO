import { Component, inject, signal, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { AuthService } from "../../core/services/auth.service";
import { API } from "../../core/config/api.config";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./profile.html",
  styleUrl: "./profile.css"
})
export class ProfileComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth         = inject(AuthService);

  loading = signal(true);
  saving  = signal(false);
  successMsg = signal("");
  errorMsg   = signal("");

  form = this.fb.group({
    firstName: ["", Validators.required],
    lastName:  ["", Validators.required],
    email:     ["", [Validators.required, Validators.email]],
    phone:     ["", [Validators.minLength(10)]],
    password:  [""] // Optional, only if changing
  });

  ngOnInit() {
    this.http.get<any>(`${API}/auth/profile`).subscribe({
      next: (res) => {
        let phone = "";
        if (res.role === "STUDENT" && res.studentProfile) phone = res.studentProfile.phone;
        if (res.role === "TEACHER" && res.teacherProfile) phone = res.teacherProfile.phone;
        if (res.role === "PARENT"  && res.parentProfile)  phone = res.parentProfile.phone;
        if (res.role === "ADMIN"   && res.adminProfile)   phone = res.adminProfile.phone;

        this.form.patchValue({
          firstName: res.firstName,
          lastName: res.lastName,
          email: res.email,
          phone: phone || ""
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.successMsg.set("");
    this.errorMsg.set("");

    const val = this.form.value;
    const payload: any = {
      firstName: val.firstName,
      lastName: val.lastName,
      email: val.email,
    };
    if (val.phone) payload.phone = val.phone;
    if (val.password) payload.password = val.password;

    this.http.put(`${API}/users/profile`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set("¡Perfil actualizado correctamente!");
        this.form.get("password")?.setValue(""); // Clear password field
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message || "Error al actualizar perfil");
      }
    });
  }
}

