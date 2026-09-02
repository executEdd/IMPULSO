import { environment } from '../../../environments/environment';

export const API = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? '/api'
  : (environment.apiUrl || '/api');
