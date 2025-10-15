import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppConfigService } from './app-config.service';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer' | string;
  expires_in: number;
  scope?: string;
  hasMFA?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private tokenKey = 'TOKEN';
  private token: string | null = null;
  public readonly token$ = new BehaviorSubject<string | null>(null);

  private getTokenUrl(): string {
    const fromCfg = this.appConfig.get('oauthTokenEndpoint') as string | undefined;
    const endpoint = (fromCfg ?? environment.oauthTokenEndpoint ?? '/api/oauth2/v1/token');
    const path = endpoint.startsWith('/') ? endpoint : ('/' + endpoint);
    const abs = this.appConfig.get('absoluteBaseUrl') as string | undefined;
    if (abs && /^https?:\/\//i.test(abs)) {
      return `${abs.replace(/\/+$/,'')}${path}`;
    }
    return path; // proxy/Protheus interceptor cuidam do prefixo
  }

  constructor() {
    try {
      const raw = sessionStorage.getItem(this.tokenKey) || sessionStorage.getItem('ERPTOKEN');
      if (raw) {
        const parsed = JSON.parse(raw);
        const t = parsed?.access_token || parsed?.token || null;
        if (t) {
          this.token = t;
          this.token$.next(t);
          this.debugLog('ctor: token restaurado', t);
        }
      }
    } catch {}
  }

  public setToken(token: string): void {
    this.token = token;
    this.token$.next(token);
    try { sessionStorage.setItem(this.tokenKey, JSON.stringify({ access_token: token, token_type: 'Bearer' })); sessionStorage.setItem('ERPTOKEN', JSON.stringify({ access_token: token, token_type: 'Bearer' })); } catch {}
    this.debugLog('setToken', token);
  }

  getToken(): string | null { return this.token; }

  clearToken() {
    this.token = null;
    this.token$.next(null);
    try { sessionStorage.removeItem(this.tokenKey); } catch {}
    if (!environment.production) console.debug('[AuthService] clearToken');
  }

  requestToken(username: string, password: string): Observable<OAuthTokenResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': '*/*' });

    const postWith = (grant: string) => {
      const form = new HttpParams({ fromObject: { grant_type: grant, username, password } });
      return this.http.post<OAuthTokenResponse>(this.getTokenUrl(), form.toString(), { headers }).pipe(
        tap(resp => this.handleTokenResponse('requestToken POST ' + grant, resp))
      );
    };

    const postWithQuery = (grant: string) => {
      const qs = new HttpParams({ fromObject: { grant_type: grant, username, password } }).toString();
      const url = `${this.getTokenUrl()}?${qs}`;
      return this.http.post<OAuthTokenResponse>(url, null, { headers }).pipe(
        tap(resp => this.handleTokenResponse('requestToken POST-QUERY ' + grant, resp))
      );
    };

    const getWith = (grant: string) => {
      const qs = new HttpParams({ fromObject: { grant_type: grant, username, password } });
      return this.http.get<OAuthTokenResponse>(this.getTokenUrl(), { params: qs }).pipe(
        tap(resp => this.handleTokenResponse('requestToken GET ' + grant, resp))
      );
    };

    return postWith('PASSWORD').pipe(
      catchError((err) => { this.debugLog('requestToken POST PASSWORD error', null); console.error(err); return postWithQuery('PASSWORD'); }),
      catchError((err) => { this.debugLog('requestToken POST-QUERY PASSWORD error', null); console.error(err); return postWith('password'); }),
      catchError((err) => { this.debugLog('requestToken POST password error', null); console.error(err); return postWithQuery('password'); }),
      catchError((err) => { this.debugLog('requestToken POST-QUERY password error', null); console.error(err); return getWith('PASSWORD'); }),
      catchError((err) => { this.debugLog('requestToken GET PASSWORD error', null); console.error(err); return getWith('password'); }),
    );
  }

  private handleTokenResponse(ctx: string, resp: OAuthTokenResponse | null | undefined) {
    const token = resp?.access_token ?? null;
    this.token = token;
    if (token) {
      try { sessionStorage.setItem(this.tokenKey, JSON.stringify(resp)); sessionStorage.setItem('ERPTOKEN', JSON.stringify(resp)); } catch {}
      this.token$.next(token);
    }
    this.debugLog(ctx, token);
  }

  private debugLog(context: string, token: string | null) {
    if (environment.production) return;
    const masked = token ? `${token.substring(0, 10)}...${token.substring(token.length - 6)}` : 'null';
    console.debug(`[AuthService] ${context} -> token=${masked}`);
  }
}



