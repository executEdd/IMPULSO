import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { API } from '../../core/config/api.config';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  get canSend() { const r = this.auth.user()?.role; return r === 'ADMIN' || r === 'TEACHER'; }
  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }
  get isStudent() { return this.auth.user()?.role === 'STUDENT'; }
  get isParent()  { return this.auth.user()?.role === 'PARENT'; }

  get pageTitle(): string {
    if (this.isStudent) return 'Mis Avisos y Alertas';
    if (this.isParent)  return 'Avisos e Informes Escolares';
    return 'Centro de Notificaciones';
  }

  get pageSubtitle(): string {
    if (this.isStudent) return 'Consulta tus avisos recibidos y gestiona tus alertas';
    if (this.isParent)  return 'Consulta comunicaciones oficiales y comunicados de la institución';
    return 'Historial de mensajes, envío de avisos y preferencias de alertas';
  }

  loading       = signal(true);
  sending       = signal(false);
  records       = signal<any[]>([]);
  activeTab     = signal<'history' | 'send' | 'global' | 'preferences'>('history');

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

  globalForm = this.fb.group({
    channel:       ['IN_APP'],
    content:       ['', [Validators.required, Validators.minLength(5)]],
    targets:       [[] as string[]] // Optional roles
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
    const endpoint = this.isAdmin ? `${API}/notifications` : `${API}/notifications/my-notifications`;
    this.http.get<any[]>(endpoint).subscribe({
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
            platform: 'WEB_PUSH',
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

  sendGlobal() {
    if (this.globalForm.invalid || this.sending()) return;
    this.sending.set(true);
    
    const v = this.globalForm.value;
    const payload = {
      content: v.content,
      channel: v.channel,
      targetRoles: v.targets && v.targets.length > 0 ? v.targets : undefined
    };

    this.http.post(`${API}/notifications/global`, payload).subscribe({
      next: (res: any) => {
        this.showToast(`Aviso global enviado a ${res.count} usuarios`, true);
        this.globalForm.reset({ channel: 'IN_APP', targets: [] });
        this.sending.set(false);
        this.fetchHistory();
      },
      error: () => {
        this.showToast('Error al enviar el aviso global', false);
        this.sending.set(false);
      }
    });
  }

  private showToast(msg: string, ok: boolean) {
    this.toastMsg.set(msg);
    this.toastOk.set(ok);
    setTimeout(() => this.toastMsg.set(''), 3500);
  }

  ngOnDestroy() {}

  statusClass(s: string) {
    const m: Record<string, string> = { SENT: 'chip-green', PENDING: 'chip-yellow', FAILED: 'chip-red', READ: 'chip-blue', SIMULATED: 'chip-gray' };
    return m[s] ?? 'chip-yellow';
  }
  statusLabel(s: string) {
    const m: Record<string, string> = { SENT: 'Enviado', PENDING: 'Pendiente', FAILED: 'Fallido', READ: 'Leído', SIMULATED: 'Simulado' };
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
