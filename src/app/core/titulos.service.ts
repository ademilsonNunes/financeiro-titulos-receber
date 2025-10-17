import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AppConfigService } from './app-config.service';

export interface TituloReceberDTO {
  empresa: string;
  nf: string;
  parcela: string;
  codigoCliente: string;
  nomeCliente: string;
  vendedor: string;
  condicaoPagamento: string;
  formaPagamento: string;
  uf: string;
  municipio: string;
  rede: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  saldo: number;
  numeroBanco: string;
  bordero: string;
  boleto: string;
  devolucao: string;
  statusCanhotaRecebido: string;
  statusCanhotaRetorno: string;
  dataRecebimentoCliente: string;
  dataRecebimentoCanhoto: string;
  dataBaixaCanhoto: string;
  observacao: string;
  chaveNFe: string;
}

export interface TituloFilters {
  empresa?: string;
  nf?: string;
  codigoCliente?: string;
  nomeCliente?: string;
  uf?: string;
  municipio?: string;
  vendedor?: string;
  formaPagamento?: string;
  statusCanhotaRecebido?: string;
  statusCanhotaRetorno?: string;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  dataVencimentoInicio?: string;
  dataVencimentoFim?: string;
}

@Injectable({ providedIn: 'root' })
export class TitulosService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private base = '';

  constructor() {
    this.base = `${this.getApiBasePath()}/v1/titulos-receber`;
  }

  private getApiBasePath(): string {
    const abs = this.appConfig.get('absoluteBaseUrl') as string | undefined;
    if (abs && /^https?:\/\//i.test(abs)) {
      return `${abs.replace(/\/+$/, '')}/app-root/api`;
    }

    const fromCfg = this.appConfig.get('apiBasePath') as string | undefined;
    const raw = (fromCfg ?? environment.apiBasePath ?? '/api');

    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, '');
    }

    const normalized = raw.startsWith('/') ? raw : ('/' + raw);
    return normalized.replace(/\/+$/, '');
  }

  list(filters: TituloFilters = {}): Observable<TituloReceberDTO[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    const headers = new HttpHeaders({
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });

    if (!(environment as any).production) {
      try {
        const p: any = {};
        (params as any).keys?.().forEach((k: string) => (p[k] = params.get(k)));
        console.debug('[TitulosService] GET', this.base, { params: p });
      } catch {}
    }

    return this.http
      .get(this.base, { params, headers, responseType: 'text', observe: 'response' })
      .pipe(
        map((resp) => {
          const body = resp.body || '';
          if (!body) return [];
          const sanitized = (body as string).replace(/^\uFEFF/, '').trim();
          let parsed: any;
          try {
            parsed = JSON.parse(sanitized);
          } catch (e) {
            console.error('Falha ao parsear resposta da API de títulos:', {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers?.keys()?.reduce((acc: any, k) => { acc[k] = resp.headers?.get(k); return acc; }, {} as any),
              bodyPreview: sanitized.substring(0, 500)
            });
            return [];
          }
          if (Array.isArray(parsed)) return parsed as TituloReceberDTO[];
          if (parsed && Array.isArray(parsed.items)) return parsed.items as TituloReceberDTO[];
          if (parsed && parsed.data) {
            if (Array.isArray(parsed.data)) return parsed.data as TituloReceberDTO[];
            if (Array.isArray(parsed.data.items)) return parsed.data.items as TituloReceberDTO[];
          }
          if (parsed && Array.isArray(parsed.value)) return parsed.value as TituloReceberDTO[];
          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              const v = (parsed as any)[k];
              if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
                return v as TituloReceberDTO[];
              }
            }
          }
          return [];
        })
      );
  }

  getByNF(nf: string): Observable<TituloReceberDTO[]> {
    return this.list({ nf });
  }
}

