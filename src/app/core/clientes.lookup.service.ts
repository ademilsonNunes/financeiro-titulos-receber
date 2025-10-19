import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PoLookupFilter, PoLookupFilteredItemsParams, PoLookupResponseApi } from '@po-ui/ng-components';
import { ClientesService, ClienteDTO } from './clientes.service';

@Injectable({ providedIn: 'root' })
export class ClientesLookupService implements PoLookupFilter {
  private svc = inject(ClientesService);

  getFilteredItems(params: PoLookupFilteredItemsParams): Observable<PoLookupResponseApi> {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 10);
    const rawFilter = String((params?.filter ?? (params as any)?.search ?? (params as any)?.q ?? ''));
    const filter = rawFilter.trim();
    const hasDigits = /\d/.test(filter);

    const norm = (s: string) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
    const filterNorm = norm(filter).toLowerCase();

    // Envia múltiplos parâmetros para maximizar compatibilidade (similar ao transportador)
    const query: Record<string, any> = { page, pageSize };
    if (filter) {
      query['search'] = filter;
      query['q'] = filter;
      query['codigo'] = filter;
      query['nome'] = filter;
    }

    return this.svc.list(query).pipe(
      map((items) => {
        const filtered = (items ?? []).filter((c) => {
          const codigo = (c.codigo ?? '').toString();
          const nome = (c.nome ?? '').toString();
          const cnpj = (c.cnpj ?? '').toString();
          const loja = (c.loja ?? '').toString();
          const municipio = (c.municipio ?? '').toString();
          const estado = (c.estado ?? '').toString();
          const tipoFrete = (c.tipoFrete ?? '').toString();

          // Pesquisa por código e parte do nome (case/acentos-insensitive)
          const codigoMatch = filter ? codigo.includes(filter) : true;
          const nomeMatch = filter ? norm(nome).toLowerCase().includes(filterNorm) : true;
          const lojaMatch = filter ? loja.includes(filter) : true;
          const municipioMatch = filter ? norm(municipio).toLowerCase().includes(filterNorm) : true;
          const estadoMatch = filter ? norm(estado).toLowerCase().includes(filterNorm) : true;
          const tipoFreteMatch = filter ? tipoFrete.toLowerCase().includes(filterNorm) : true;

          // Corrige: cnpjMatch deve ser falso por padrão e só considerar quando há dígitos
          let cnpjMatch = false;
          if (filter && hasDigits) {
            const onlyDigits = (str: string) => str.replace(/\D/g, '');
            cnpjMatch = onlyDigits(cnpj).includes(onlyDigits(filter));
          }

          return codigoMatch || nomeMatch || lojaMatch || municipioMatch || estadoMatch || tipoFreteMatch || cnpjMatch;
        });

        // Paginação no cliente
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
      map((items: ClienteDTO[]) => {
        const match = items.find(c => (c.codigo ?? (c as any).codigoCliente ?? (c as any).id ?? '').toString().trim() === code);
        return match ?? null;
      })
    );
  }
}