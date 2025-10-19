import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PoLookupFilter, PoLookupFilteredItemsParams, PoLookupResponseApi } from '@po-ui/ng-components';
import { TransportadorasService, TransportadoraDTO } from './transportadoras.service';

@Injectable({ providedIn: 'root' })
export class TransportadorasLookupService implements PoLookupFilter {
  private svc = inject(TransportadorasService);

  getFilteredItems(params: PoLookupFilteredItemsParams): Observable<PoLookupResponseApi> {
    // Captura o termo de busca considerando diferentes chaves possíveis
    const filterRaw = String((params?.filter ?? (params as any)?.search ?? (params as any)?.q ?? ''));
    const filter = filterRaw.trim();
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 10);

    // Tenta buscar paginado no servidor; envia múltiplos parâmetros para maximizar compatibilidade.
    const query: Record<string, any> = { page, pageSize };
    if (filter) {
      query['search'] = filter; // comum em APIs TOTVS
      query['q'] = filter;
      query['codigo'] = filter;
      query['nome'] = filter;
    }

    return this.svc.list(query).pipe(
      map((items: TransportadoraDTO[]) => {
        // Filtro de segurança no cliente (case/diacrítico-insensitive, e numérico para CNPJ/código)
        const norm = (s: string) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const filterNorm = norm(filter);
        const filterDigits = filter.replace(/\D/g, '');

        const filtered = !filter
          ? items
          : items.filter(t => {
              const codigo = (t.codigo ?? '').toString();
              const nome = (t.nome ?? '').toString();
              const cnpj = (t.cnpj ?? '').toString();
              const cnpjDigits = cnpj.replace(/\D/g, '');
              return (
                // por código (string contém)
                codigo.includes(filter) ||
                // por nome (case/acento-insensitive)
                norm(nome).includes(filterNorm) ||
                // por CNPJ (apenas quando há dígitos no filtro)
                (filterDigits.length > 0 && cnpjDigits.includes(filterDigits))
              );
            });

        // Paginação no cliente caso o servidor não suporte page/pageSize.
        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);
        const hasNext = pageItems.length === pageSize && (filtered.length > start + pageSize);
        return { items: pageItems, hasNext, page } as PoLookupResponseApi;
      })
    );
  }

  getObjectByValue(value: string | Array<any>): Observable<any> {
    const val = Array.isArray(value) ? (value[0] ?? '') : value;
    const code = (val ?? '').toString().trim();
    return this.svc.list({ codigo: code }).pipe(
      map((items: TransportadoraDTO[]) => {
        const match = items.find(t => (t.codigo ?? (t as any).codigoTransportadora ?? (t as any).id ?? '').toString().trim() === code);
        return match ?? null;
      })
    );
  }
}