import { HttpEvent, HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { isDevMode } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';

function maskToken(raw: any): any {
  try {
    const clone = JSON.parse(JSON.stringify(raw));
    const mask = (val: string) => val && val.length > 16 ? `${val.slice(0, 10)}...${val.slice(-6)}` : val;
    const walk = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        if (k.toLowerCase().includes('token')) {
          if (typeof obj[k] === 'string') obj[k] = mask(obj[k]);
          if (obj[k] && obj[k].access_token) obj[k].access_token = mask(obj[k].access_token);
        } else {
          walk(obj[k]);
        }
      }
    };
    walk(clone);
    return clone;
  } catch {
    return raw;
  }
}

export const loggingInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  if (!isDevMode()) return next(req);

  const started = performance.now();
  const shortUrl = req.url.replace(/^https?:\/\/[^/]+/, '');
  const isTokenCall = shortUrl.includes('/oauth2/');
  const reqInfo = {
    method: req.method,
    url: shortUrl,
    headers: { Accept: req.headers.get('Accept'), 'Content-Type': req.headers.get('Content-Type'), Authorization: req.headers.has('Authorization') ? 'Bearer ...' : undefined },
    body: isTokenCall ? '[hidden]' : (req as any).body,
  };
  console.debug('[HTTP] ->', reqInfo);

  return next(req).pipe(
    tap((evt: any) => {
      if (evt instanceof HttpResponse) {
        const ms = Math.round(performance.now() - started);
        const respInfo = {
          url: shortUrl,
          status: evt.status,
          statusText: evt.statusText,
          timeMs: ms,
          headers: { 'content-type': evt.headers.get('content-type') },
          body: isTokenCall ? maskToken(evt.body) : evt.body,
        };
        console.debug('[HTTP] <-', respInfo);
      }
    }),
    catchError((err: HttpErrorResponse) => {
      const ms = Math.round(performance.now() - started);
      const errInfo = {
        url: shortUrl,
        status: err.status,
        statusText: err.statusText,
        timeMs: ms,
        message: err.message,
        error: isTokenCall ? maskToken(err.error) : err.error,
      };
      console.error('[HTTP] x ', errInfo);
      throw err;
    })
  );
};


