import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AppConfigService } from './app-config.service';

export interface TransportadoraDTO {
  codigo?: string;
  nome?: string;
  cnpj?: string;
  codigoTransportadora?: string;
  nomeTransportadora?: string;
  id?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class TransportadorasService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private base = '';

  constructor() {
    this.base = `${this.getApiBasePath()}/v1/transportadoras`;
  }

  private getApiBasePath(): string {
    const abs = this.appConfig.get('absoluteBaseUrl') as string | undefined;
    if (abs && /^https?:\/\//i.test(abs)) {
      return `${abs.replace(/\/+$/,'')}/app-root/api`;
    }
    const fromCfg = this.appConfig.get('apiBasePath') as string | undefined;
    const raw = (fromCfg ?? environment.apiBasePath ?? '/api');
    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/,'');
    }
    const normalized = raw.startsWith('/') ? raw : ('/' + raw);
    return normalized.replace(/\/+$/,'');
  }

  list(paramsObj: Record<string, any> = {}): Observable<TransportadoraDTO[]> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([key, value]) => {
      const hasValue = value !== undefined && value !== null && value !== '';
      if (!hasValue) return;
      params = params.set(key, String(value).trim());
    });

    const headers = new HttpHeaders({
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });

    return this.http
      .get(this.base, { params, headers, responseType: 'text', observe: 'response' })
      .pipe(
        map((resp) => {
          const body = resp.body || '';
          const sanitized = (body as string).replace(/^\uFEFF/, '').trim();
          let parsed: any;
          try {
            parsed = sanitized ? JSON.parse(sanitized) : [];
          } catch {
            console.error('Falha ao parsear resposta da API de transportadoras:', {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers?.keys()?.reduce((acc: any, k) => { acc[k] = resp.headers?.get(k); return acc; }, {} as any),
              bodyPreview: sanitized.substring(0, 500),
            });
            return [];
          }
          let arr: any[] = [];
          if (Array.isArray(parsed)) arr = parsed;
          else if (parsed && Array.isArray(parsed.items)) arr = parsed.items;
          else if (parsed && parsed.data) {
            if (Array.isArray(parsed.data)) arr = parsed.data;
            else if (Array.isArray(parsed.data.items)) arr = parsed.data.items;
          } else if (parsed && Array.isArray(parsed.value)) arr = parsed.value;
          else if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              const v = (parsed as any)[k];
              if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
                arr = v;
                break;
              }
            }
          }
          return arr.map((t: any) => ({
            codigo: t.codigo ?? t.codigoTransportadora ?? t.id ?? '',
            nome: t.nome ?? t.nomeTransportadora ?? t.razaoSocial ?? t.fantasia ?? '',
            cnpj: t.cnpj ?? t.cpfCnpj ?? t.documento ?? '',
            raw: t,
          } as TransportadoraDTO));
        })
      );
  }
}