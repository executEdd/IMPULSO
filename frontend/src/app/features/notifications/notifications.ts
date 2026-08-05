import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { API } from '../../core/config/api.config';

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

  loading       = signal(true);
  sending       = signal(false);
  records       = signal<any[]>([]);
  activeTab     = signal<'history' | 'send' | 'preferences'>('history');

  // Preferencias de notificación
  prefsLoading  = signal(false);
  preferences   = signal<any[]>([]);
  pushRegistered = signal(false);
  pushLoading   = signal(false);

  toastMsg   = signal('');
  toastOk    = signal(true);

  form = this.fb.group({
    recipientType: ['STUDENT', Validators.required],
    recipientId:   [null as number | null, Validators.required],
    channel:       ['IN_APP', Validators.required],
    content:       ['', [Validators.required, Validators.minLength(5)]]
  });

  channelsList = [
    { key: 'IN_APP',   label: 'Notificaciones en la App', icon: 'fa-bell', description: 'Alertas en tiempo real dentro del panel del sistema' },
    { key: 'EMAIL',    label: 'Correo Electrónico',      icon: 'fa-envelope', description: 'Avisos y boletines enviados a tu cuenta de correo' },
    { key: 'WHATSAPP', label: 'WhatsApp Institucional',  icon: 'fa-whatsapp', description: 'Notificaciones urgentes y reportes de inasistencia' },
    { key: 'SMS',      label: 'Mensajes de Texto (SMS)', icon: 'fa-comment-sms', description: 'Alertas críticas de seguridad y semáforo' },
    { key: 'PUSH',     label: 'Notificaciones Push',     icon: 'fa-mobile-screen-button', description: 'Alertas emergentes en tu navegador o celular' }
  ];

  ngOnInit() {
    this.fetchHistory();
    this.fetchPreferences();
  }

  fetchHistory() {
    this.http.get<any[]>(`${API}/notifications`).subscribe({
      next: data => { this.records.set(data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  fetchPreferences() {
    this.prefsLoading.set(true);
    this.http.get<any[]>(`${API}/notification-preferences`).subscribe({
      next: list => {
        this.preferences.set(list ?? []);
        this.prefsLoading.set(false);
      },
      error: () => this.prefsLoading.set(false)
    });
  }

  isChannelEnabled(channel: string): boolean {
    const p = this.preferences().find(x => x.channel === channel);
    return p ? p.enabled : true;
  }

  togglePreference(channel: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    // optimistic update
    this.preferences.update(list => {
      const idx = list.findIndex(x => x.channel === channel);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], enabled: newStatus };
        return copy;
      }
      return [...list, { channel, enabled: newStatus }];
    });

    this.http.put(`${API}/notification-preferences`, { channel, enabled: newStatus }).subscribe({
      next: () => this.showToast(`Preferencia de ${this.channelLabel(channel)} actualizada`, true),
      error: () => {
        this.showToast('No se pudo actualizar la preferencia', false);
        this.fetchPreferences();
      }
    });
  }

  registerWebPush() {
    if (this.pushLoading()) return;
    this.pushLoading.set(true);

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      this.showToast('Tu navegador no soporta Notificaciones Push', false);
      this.pushLoading.set(false);
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        this.showToast('Permiso de notificaciones denegado en el navegador', false);
        this.pushLoading.set(false);
        return;
      }

      this.http.get<{ publicKey: string }>(`${API}/push/vapid-public-key`).subscribe({
        next: (res) => {
          const mockToken = `web-push-token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          this.http.post(`${API}/push/register`, {
            token: mockToken,
            platform: 'WEB',
            userAgent: navigator.userAgent
          }).subscribe({
            next: () => {
              this.pushRegistered.set(true);
              this.pushLoading.set(false);
              this.showToast('¡Notificaciones Push activadas en este dispositivo!', true);
            },
            error: () => {
              this.pushLoading.set(false);
              this.showToast('Error al registrar token de notificaciones', false);
            }
          });
        },
        error: () => {
          this.pushLoading.set(false);
          this.showToast('No se pudo obtener la clave VAPID de notificaciones', false);
        }
      });
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
        this.fetchHistory();
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
    const m: Record<string, string> = { EMAIL: 'fa-envelope', SMS: 'fa-comment-sms', IN_APP: 'fa-bell', WHATSAPP: 'fa-whatsapp', PUSH: 'fa-mobile-screen-button' };
    return m[c] ?? 'fa-bell';
  }
  channelLabel(c: string) {
    const m: Record<string, string> = { EMAIL: 'Correo', SMS: 'SMS', IN_APP: 'En app', WHATSAPP: 'WhatsApp', PUSH: 'Push' };
    return m[c] ?? c;
  }
}
