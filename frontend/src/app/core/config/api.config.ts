import { environment } from '../../../environments/environment';

export const API = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3000/api'
  : (environment.apiUrl || 'http://localhost:3000/api');
