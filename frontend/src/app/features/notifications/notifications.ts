import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

const API = (import.meta as any).env.NG_APP_API_URL;

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class NotificationsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);

  loading    = signal(true);
  sending    = signal(false);
  records    = signal<any[]>([]);
  activeTab  = signal<'history' | 'send'>('history');
  toastMsg   = signal('');
  toastOk    = signal(true);

  form = this.fb.group({
    recipientType: ['STUDENT', Validators.required],
    recipientId:   [null as number | null, Validators.required],
    channel:       ['IN_APP', Validators.required],
    content:       ['', [Validators.required, Validators.minLength(5)]]
  });

  ngOnInit() {
    this.http.get<any[]>(`${API}/notifications`).subscribe({
      next: data => { this.records.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  send() {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.http.post(`${API}/notifications/send-manual`, this.form.value).subscribe({
      next: () => {
        this.showToast('Notificación enviada correctamente', true);
        this.form.reset({ recipientType: 'STUDENT', channel: 'IN_APP' });
        this.sending.set(false);
      },
      error: () => {
        this.showToast('Error al enviar la notificación', false);
        this.sending.set(false);
      }
    });
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }

  statusClass(s: string) {
    const m: Record<string, string> = { SENT: 'chip-green', PENDING: 'chip-yellow', FAILED: 'chip-red' };
    return m[s] ?? 'chip-yellow';
  }
  statusLabel(s: string) {
    const m: Record<string, string> = { SENT: 'Enviado', PENDING: 'Pendiente', FAILED: 'Fallido' };
    return m[s] ?? s;
  }
  channelIcon(c: string) {
    const m: Record<string, string> = { EMAIL: 'fa-envelope', SMS: 'fa-comment-sms', IN_APP: 'fa-bell' };
    return m[c] ?? 'fa-bell';
  }
  channelLabel(c: string) {
    const m: Record<string, string> = { EMAIL: 'Correo', SMS: 'SMS', IN_APP: 'En app' };
    return m[c] ?? c;
  }
}
