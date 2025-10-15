import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  let token = auth.getToken();

  // Support token injected by Protheus (sessionStorage TOKEN or ERPTOKEN)
  if (!token && typeof window !== 'undefined') {
    try {
      const rawToken = sessionStorage.getItem('TOKEN') || sessionStorage.getItem('ERPTOKEN') || '{}';
      const stored = JSON.parse(rawToken);
      if (stored && (stored.access_token || stored.token)) token = stored.access_token || stored.token;
    } catch { /* ignore */ }
  }

  const urlStr = req.url;
  let path = '';
  try {
    const u = new URL(urlStr, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    path = u.pathname || '';
  } catch {
    path = urlStr as any;
  }

  const isApiRequest = path.startsWith('/api') || path.startsWith('/app-root/api');
  const isTokenEndpoint = path.includes('/oauth2/');

  // In production inside Protheus, ensure /app-root prefix for absolute app paths that are relative
  if (environment.production && path.startsWith('/api')) {
    req = req.clone({ url: `/app-root${path}` });
  }

  const shouldAttach = !!(token && isApiRequest && !isTokenEndpoint);
  if (!environment.production) {
    const masked = token ? `${token.substring(0, 10)}...${token.substring(token.length - 6)}` : 'null';
    console.debug('[AuthInterceptor]', { url: urlStr, path, isApiRequest, isTokenEndpoint, hasToken: !!token, attachAuth: shouldAttach, token: masked });
  }

  if (shouldAttach) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!req.headers.has('Accept')) headers['Accept'] = '*/*';
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
};
