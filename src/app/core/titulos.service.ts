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
  condicaoPagamentoNF?: string; // novo campo
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
  romaneio?: string; // novo campo
  codigoTransportadora?: string; // novo campo
  nomeTransportadora?: string; // novo campo
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
  romaneio?: string;
  codigoTransportadora?: string;
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
      const hasValue = value !== undefined && value !== null && value !== '';
      if (!hasValue) return;
      let val: string;
      if (value instanceof Date) {
        val = value.toISOString().substring(0, 10); // yyyy-MM-dd
      } else {
        val = String(value).trim();
      }
      params = params.set(key, val);
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

  /**
   * Confirma o recebimento (baixa) do canhoto via API.
   * Endpoint: PUT /api/v1/titulos-receber/:nf/:parcela/confirmar-entrega
   * Body: { dataRecebimento: "YYYYMMDD" }
   */
  confirmarRecebimento(nf: string, parcela: string, dataRecebimento: string): Observable<any> {
    if (!nf || !parcela) {
      throw new Error('NF e parcela são obrigatórias');
    }
    if (!/^\d{8}$/.test(String(dataRecebimento))) {
      throw new Error('Data deve estar no formato YYYYMMDD (8 dígitos)');
    }
    const url = `${this.base}/${encodeURIComponent(String(nf))}/${encodeURIComponent(String(parcela))}/confirmar-entrega`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });
    return this.http
      .put(url, { dataRecebimento }, { headers, observe: 'response', responseType: 'text' })
      .pipe(
        map((resp) => {
          const body = resp.body || '';
          let parsed: any = null;
          try {
            parsed = JSON.parse(String(body).replace(/^\uFEFF/, '').trim());
          } catch {
            parsed = { message: String(body).substring(0, 200) };
          }
          return { status: resp.status, ok: resp.status >= 200 && resp.status < 300, data: parsed };
        })
      );
  }
}

