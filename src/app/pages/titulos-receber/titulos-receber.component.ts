import { Component, DestroyRef, OnInit, ViewChild, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PoPageModule, PoModalModule, PoModalComponent, PoTableModule, PoTableAction, PoNotificationService, PoNotificationModule, PoLoadingModule, PoTagModule, PoFieldModule } from '@po-ui/ng-components';
import { PoInfoModule, PoButtonGroupModule, PoButtonGroupItem, PoButtonModule } from '@po-ui/ng-components';
import { TitulosService, TituloFilters, TituloReceberDTO } from '../../core/titulos.service';
import { AuthService } from '../../core/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TransportadorasLookupService } from '../../core/transportadoras.lookup.service';
import { ClientesLookupService } from '../../core/clientes.lookup.service';
import { TransportadorasService } from '../../core/transportadoras.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-titulos-receber',
  standalone: true,
  imports: [
    PoInfoModule,
    PoButtonGroupModule,
    PoButtonModule,
    CommonModule,
    FormsModule,
    PoPageModule,
    PoModalModule,
    PoTableModule,
    PoNotificationModule,
    PoLoadingModule,
    PoTagModule,
    PoFieldModule,
   ],
  template: `
  <po-page-default p-title="Canhotos em aberto" [attr.aria-busy]="loading">
    <div class="filters">
      <po-input name="nf" p-label="Nota Fiscal" [(ngModel)]="filters.nf"></po-input>
      <po-lookup
           name="codigoCliente"
           p-label="Código Cliente"
           [(ngModel)]="filters.codigoCliente"
           (ngModelChange)="onClienteChanged($event)"
           [p-filter-service]="clientesLookup"
           p-field-label="codigo"
           p-field-value="codigo"
           [p-columns]="clientesColumns"
         ></po-lookup>
      <po-input name="romaneio" p-label="Romaneio" [(ngModel)]="filters.romaneio"></po-input>
      <po-lookup
           name="codigoTransportadora"
           p-label="Cód. Transportadora"
           [(ngModel)]="filters.codigoTransportadora"
           (ngModelChange)="onTransportadoraChanged($event)"
           [p-filter-service]="transportadorasLookup"
           p-field-label="codigo"
           p-field-value="codigo"
           [p-columns]="transportadorasColumns"
         ></po-lookup>
      <po-input name="formaPagamento" p-label="Forma de Pagamento" [(ngModel)]="filters.formaPagamento" *ngIf="false"></po-input>
      <div class="date-range">
        <po-datepicker name="dataEmissaoInicio" p-label="Emissão Início" [(ngModel)]="filters.dataEmissaoInicio"></po-datepicker>
        <po-datepicker name="dataEmissaoFim" p-label="Emissão Fim" [(ngModel)]="filters.dataEmissaoFim"></po-datepicker>
      </div>
      <div class="date-range">
        <po-datepicker name="dataVencimentoInicio" p-label="Vencimento Início" [(ngModel)]="filters.dataVencimentoInicio"></po-datepicker>
        <po-datepicker name="dataVencimentoFim" p-label="Vencimento Fim" [(ngModel)]="filters.dataVencimentoFim"></po-datepicker>
      </div>
      <div class="actions">
        <po-button p-label="Pesquisar" (click)="search()"></po-button>
        <po-button p-type="secondary" p-label="Limpar" (click)="clearFilters()"></po-button>
        <po-button p-type="link" p-label="Atualizar" (click)="search()"></po-button>
      </div>
    </div>

    <po-info p-label="Browse de Cadastro" p-value="Abaixo as informações dos Canhotos em aberto"></po-info>

    <po-loading *ngIf="loading"></po-loading>

    <div class="empty-state" *ngIf="!loading && (!titulos || titulos.length === 0)" role="status" aria-live="polite">
      <po-info p-label="Nenhum resultado" p-value="Ajuste os filtros e pesquise novamente"></po-info>
      <div class="actions">
        <po-button p-type="primary" p-label="Pesquisar" (click)="search()"></po-button>
        <po-button p-type="secondary" p-label="Limpar filtros" (click)="clearFilters()"></po-button>
      </div>
    </div>

    <div class="table-scroll" #tableScrollRef role="region" aria-label="Resultados" aria-live="polite" tabindex="0">
      <po-table [p-auto-collapse]="true" [p-striped]="true" [p-sort]="true" [p-hide-table-search]="false" [p-actions-right]="true" [p-columns]="columns" [p-items]="pagedTitulos" [p-actions]="tableActions" (p-row-click)="openDetails($any($event))"></po-table>
    </div>

    <div class="debug-overlay" *ngIf="showDebug">
      <div>Viewport: {{viewportW}} x {{viewportH}}</div>
      <div>Sidebar width: {{sidebarWidth}}px</div>
      <div>Grid cols: {{gridColumns}}</div>
      <div>Tabela: client {{tableClientWidth}}px / scroll {{tableScrollWidth}}px</div>
      <div>Overflow horizontal: {{tableOverflows ? 'sim' : 'não'}}</div>
    </div>

    <div class="pagination" aria-label="Paginação" aria-live="polite">
      <po-button-group [p-buttons]="paginationButtons"></po-button-group>
      <div class="page-size" role="group" aria-label="Itens por página">
        <po-button-group [p-buttons]="pageSizeButtons"></po-button-group>
      </div>
      <span class="page-info">Página {{ page }} de {{ totalPages }}</span>
    </div>

    <po-modal #detailsModal p-title="Detalhes do Título">
      <div class="details-content" *ngIf="selected">
        <div class="row"><strong>NF:</strong> {{ selected.nf }} | <strong>Parcela:</strong> {{ selected.parcela }}</div>
        <div class="row"><strong>Cliente:</strong> {{ selected.codigoCliente }}</div>
        <div class="row"><strong>Valor:</strong> {{ selected.valor | currency:'BRL':'symbol-narrow' }} | <strong>Saldo:</strong> {{ selected.saldo | currency:'BRL':'symbol-narrow' }}</div>
        <div class="row"><strong>Emissão:</strong> {{ selected.dataEmissao }} | <strong>Vencimento:</strong> {{ selected.dataVencimento }}</div>
        <div class="row"><strong>Forma Pagamento:</strong> {{ selected.formaPagamento }} | <strong>Condição:</strong> {{ selected.condicaoPagamento }}</div>
    
        <div class="row"><strong>Status Recebido:</strong> <po-tag [p-value]="selected.statusCanhotaRecebido"></po-tag></div>
        <div class="row"><strong>Status Retorno:</strong> <po-tag [p-value]="selected.statusCanhotaRetorno"></po-tag></div>
        <div class="row"><strong>Chave NFe:</strong> {{ selected.chaveNFe }}</div>
      </div>
      <div class="modal-actions" *ngIf="!showBaixaInput">
        <po-button p-label="Confirmar Recebimento" p-type="primary" (click)="startBaixa()"></po-button>
        <po-button p-label="Fechar" p-type="secondary" (click)="detailsModal?.close()"></po-button>
      </div>
      <div class="baixa-form" *ngIf="showBaixaInput">
        <po-datepicker name="dataRecebimentoCliente" p-label="Data de Recebimento do Cliente" [(ngModel)]="baixaDate"></po-datepicker>
        <div class="modal-actions">
          <po-button p-label="Salvar Baixa" p-type="primary" (click)="submitBaixa()" [p-disabled]="baixaSaving"></po-button>
          <po-button p-label="Fechar" p-type="secondary" (click)="detailsModal?.close()"></po-button>
        </div>
      </div>
    </po-modal>


  </po-page-default>
  `,
  styleUrl: './titulos-receber.component.scss'
})
export class TitulosReceberComponent implements OnInit {
  private service = inject(TitulosService);
  private poNotification = inject(PoNotificationService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  transportadorasLookup = inject(TransportadorasLookupService);
  clientesLookup = inject(ClientesLookupService);
  private transportadorasSvc = inject(TransportadorasService);

  @ViewChild('detailsModal', { static: false }) detailsModal?: PoModalComponent;
  @ViewChild('tableScrollRef', { static: false }) tableScrollRef?: ElementRef<HTMLDivElement>;

  filters: TituloFilters = {};
  titulos: TituloReceberDTO[] = [];
  loading = false;
  selected?: TituloReceberDTO;
  showBaixaInput = false;
  baixaDate?: Date | string;
  baixaSaving = false;

  // Debug/layout metrics
  showDebug = false;
  viewportW = 0;
  viewportH = 0;
  sidebarWidth = 0;
  gridColumns = '';
  tableClientWidth = 0;
  tableScrollWidth = 0;
  tableOverflows = false;

  transportadorasColumns = [
    { property: 'codigo', label: 'Código' },
    { property: 'nome', label: 'Nome' },
    { property: 'cnpj', label: 'CNPJ' },
  ];
  clientesColumns = [
    { property: 'codigo', label: 'Código' },
    { property: 'nome', label: 'Nome' },
    { property: 'loja', label: 'Loja' },
    { property: 'municipio', label: 'Município' },
    { property: 'estado', label: 'UF' },
    { property: 'tipoFrete', label: 'Tipo Frete' },
  ];

  // Paginação
  page = 1;
  private _pageSize = 50;
  get pageSize(): number { return this._pageSize; }
  set pageSize(val: number) { this.applyPageSizeChange(val); }

  pageSizeOptions = [
    { label: '20', value: 20 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
  ];
  totalItems = 0;
  pagedTitulos: TituloReceberDTO[] = [];
  paginationButtons: PoButtonGroupItem[] = [];
  // Add page size toggle buttons using PoButtonGroup to avoid ngModel issues on PoSelect
  pageSizeButtons: PoButtonGroupItem[] = [];

  get totalPages(): number { return Math.max(1, Math.ceil(this.totalItems / this.pageSize)); }

  columns: any[] = [];

  topButtons: PoButtonGroupItem[] = [
    { label: "Atualizar Browse", icon: "po-icon-refresh", action: () => this.search() },
  ];

  tableActions: PoTableAction[] = [
    { label: 'Detalhes', action: (item: TituloReceberDTO) => this.openDetails(item) },
  ];

  ngOnInit(): void {
    // Pesquisa automaticamente se já houver token e também quando um novo token for definido
    if (this.authService.getToken()) {
      this.search();
    } else {
      this.poNotification.information('Defina o token no menu "Definir Token" para carregar a listagem.');
    }

    this.authService.token$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(t => { if (t) this.search(); });

    // Restaurar preferências de paginação
    try {
      const saved = Number((typeof window !== 'undefined' ? window.localStorage.getItem('titulos.pageSize') : null));
      if (saved && [20,50,100].includes(saved)) {
        this.pageSize = saved;
      }
    } catch {}

    this.updatePaginationButtons();
    this.updatePageSizeButtons();

    // Leitura do parâmetro de debug da URL
    try {
      const params = new URLSearchParams((typeof window !== 'undefined' ? window.location.search : ''));
      this.showDebug = params.get('debug') === '1';
    } catch {}

    // Coleta inicial de métricas de layout
    this.collectMetrics();
  }

  search(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.poNotification.warning('Sem token definido. Use "Definir Token" para colar ou gerar um novo.');
      return;
    }
    this.loading = true;
    this.service.list(this.filters).subscribe({
      next: data => {
        const raw = data ?? [];
        // Derivar colunas diretamente do retorno da API (antes de qualquer enriquecimento)
        this.columns = this.deriveColumnsFromItems(raw);
        const filtered = this.filterItems(raw);
        const ordered = this.sortByVencimentoAsc(filtered);
        this.titulos = ordered;
        this.totalItems = ordered.length;
        this.page = 1;
        this.updatePagedItems();
        this.updatePaginationButtons();
        // Opcional: enriquecer com nome da transportadora sem alterar colunas exibidas (somente colunas da API)
        this.enrichTransportadoraNames(this.titulos);
        this.loading = false;
        this.focusResultsRegion();
      },
      error: err => {
        this.loading = false;
        this.poNotification.error('Erro ao buscar títulos');
        console.error(err);
      }
    });
  }

  updatePagedItems(): void {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedTitulos = this.titulos.slice(start, end);
    this.focusResultsRegion();
  }

  // Deriva colunas dinamicamente a partir dos itens retornados pela API
  private deriveColumnsFromItems(items: any[]): any[] {
    const keySet = new Set<string>();
    (items || []).forEach(it => Object.keys(it || {}).forEach(k => keySet.add(k)));
    const allKeys = Array.from(keySet);

    // Mapa de rótulos amigáveis para chaves conhecidas
    const labelMap: Record<string, string> = {
      nf: 'NF',
      parcela: 'Parcela',
      codigoCliente: 'Cod. Cliente',
      nomeCliente: 'Nome Cliente',
      romaneio: 'Romaneio',
      codigoTransportadora: 'Cód. Transportadora',
      nomeTransportadora: 'Nome Transportadora',
      condicaoPagamentoNF: 'Cond. Pagto NF',
      dataEmissao: 'Emissão',
      dataVencimento: 'Vencimento',
      valor: 'Valor',
      saldo: 'Saldo',
      formaPagamento: 'Forma Pgto',
      statusCanhotaRecebido: 'Recebido',
      statusCanhotaRetorno: 'Retorno'
    };

    const currencyKeys = new Set(['valor', 'saldo']);

    const toLabel = (k: string) => labelMap[k] || k
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, s => s.toUpperCase());

    // Colunas preferenciais na frente, o restante em ordem alfabética
    const preferredOrder = [
      'nf','parcela','codigoCliente','nomeCliente','romaneio',
      'codigoTransportadora','condicaoPagamentoNF','dataEmissao','dataVencimento','valor','saldo','formaPagamento','statusCanhotaRecebido','statusCanhotaRetorno'
    ];
    const preferred = preferredOrder.filter(k => keySet.has(k));
    const rest = allKeys.filter(k => !preferred.includes(k)).sort((a,b) => a.localeCompare(b));
    const finalKeys = [...preferred, ...rest];

    return finalKeys.map(k => {
      const col: any = { property: k, label: toLabel(k) };
      if (currencyKeys.has(k)) {
        col.type = 'currency';
        col.format = 'BRL';
      }
      return col;
    });
  }

  private focusResultsRegion(): void {
    const el = this.tableScrollRef?.nativeElement as HTMLElement | null;
    if (el) setTimeout(() => el.focus(), 0);
  }

  private collectMetrics(): void {
    if (typeof window === 'undefined') return;
    this.viewportW = window.innerWidth;
    this.viewportH = window.innerHeight;

    const sidebarEl = document.querySelector('.sidebar') as HTMLElement | null;
    this.sidebarWidth = sidebarEl ? sidebarEl.getBoundingClientRect().width : 0;

    const contentEl = document.querySelector('.content-area') as HTMLElement | null;
    if (contentEl) {
      const cs = getComputedStyle(contentEl);
      this.gridColumns = (cs as any).gridTemplateColumns || cs.getPropertyValue('grid-template-columns');
    } else {
      this.gridColumns = '';
    }

    const el = this.tableScrollRef?.nativeElement || null;
    this.tableClientWidth = el ? el.clientWidth : 0;
    this.tableScrollWidth = el ? el.scrollWidth : 0;
    this.tableOverflows = !!(el && el.scrollWidth > el.clientWidth);
  }

  private filterItems(items: TituloReceberDTO[]): TituloReceberDTO[] {
    const f = this.filters || {};
    const hasAny = Object.entries(f).some(([_, v]) => v !== undefined && v !== null && v !== '');
    if (!hasAny) return items;

    const emiIni = this.parseDateLoose(f.dataEmissaoInicio);
    const emiFim = this.parseDateLoose(f.dataEmissaoFim);
    const venIni = this.parseDateLoose(f.dataVencimentoInicio);
    const venFim = this.parseDateLoose(f.dataVencimentoFim);

    const eq = (a: any, b: any) => String(a ?? '').trim() === String(b ?? '').trim();

    return items.filter((it) => {
      if (f.nf && !eq(it.nf, f.nf)) return false;
      if (f.codigoCliente && !eq(it.codigoCliente, f.codigoCliente)) return false;
      if (f.romaneio && !eq((it as any).romaneio, f.romaneio)) return false;
      if (f.codigoTransportadora && !eq((it as any).codigoTransportadora, f.codigoTransportadora)) return false;
      if (f.formaPagamento && !eq(it.formaPagamento, f.formaPagamento)) return false;
      if (f.statusCanhotaRecebido && !eq(it.statusCanhotaRecebido, f.statusCanhotaRecebido)) return false;
      if (f.statusCanhotaRetorno && !eq(it.statusCanhotaRetorno, f.statusCanhotaRetorno)) return false;

      const emi = this.parseDateLoose(it.dataEmissao);
      const ven = this.parseDateLoose(it.dataVencimento);

      if (emiIni && emi && emi.getTime() < emiIni.getTime()) return false;
      if (emiFim && emi && emi.getTime() > emiFim.getTime()) return false;
      if (venIni && ven && ven.getTime() < venIni.getTime()) return false;
      if (venFim && ven && ven.getTime() > venFim.getTime()) return false;

      if ((emiIni || emiFim) && !emi) return false;
      if ((venIni || venFim) && !ven) return false;

      return true;
    });
  }

  private parseDateLoose(s: any): Date | null {
    if (!s) return null;
    if (s instanceof Date) return s;
    if (typeof s === 'string') {
      const t = s.trim();
      const dIso = new Date(t);
      if (!isNaN(dIso.getTime())) return dIso;
      const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
        const dd = new Date(y, mo, d);
        if (!isNaN(dd.getTime())) return dd;
      }
    }
    return null;
  }

  private sortByVencimentoAsc(items: TituloReceberDTO[]): TituloReceberDTO[] {
    const safeStr = (s: any) => String(s ?? '').trim();
    const numOrStrCmp = (x: any, y: any) => {
      const nx = Number(safeStr(x));
      const ny = Number(safeStr(y));
      const xIsNum = !isNaN(nx);
      const yIsNum = !isNaN(ny);
      if (xIsNum && yIsNum) return nx - ny;
      return safeStr(x).localeCompare(safeStr(y), 'pt-BR', { numeric: true, sensitivity: 'base' });
    };

    // Novo critério: ordenar por vencimento mais próximo da data atual (inclui vencidos)
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const normalizedTime = (d: Date | null) => {
      if (!d) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    const distanceToToday = (d: Date | null) => {
      const t = normalizedTime(d);
      return t === null ? Number.POSITIVE_INFINITY : Math.abs(t - todayMid);
    };
    const isOverdue = (d: Date | null) => {
      const t = normalizedTime(d);
      return t !== null && t < todayMid;
    };

    return [...items].sort((a, b) => {
      const da = this.parseDateLoose(a.dataVencimento);
      const db = this.parseDateLoose(b.dataVencimento);
      const distA = distanceToToday(da);
      const distB = distanceToToday(db);

      // 1) Primeiro pela distância ao dia atual (menor distância primeiro)
      if (distA !== distB) return distA - distB;

      // 2) Desempate: prioriza vencidos sobre futuros se a distância for igual
      const overdueA = isOverdue(da) ? 1 : 0;
      const overdueB = isOverdue(db) ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;

      // 3) Desempates estáveis pelos campos NF e Código do Cliente
      const nfCmp = numOrStrCmp(a.nf, b.nf);
      if (nfCmp !== 0) return nfCmp;
      return numOrStrCmp(a.codigoCliente, b.codigoCliente);
    });
  }

  private updatePaginationButtons(): void {
    const last = this.totalPages;
    this.paginationButtons = [
      { label: 'Primeira', action: () => this.goToPage(1), disabled: this.page <= 1 },
      { label: 'Anterior', action: () => this.prevPage(), disabled: this.page <= 1 },
      { label: 'Próxima', action: () => this.nextPage(), disabled: this.page >= last },
      { label: 'Última', action: () => this.goToPage(last), disabled: this.page >= last },
    ];
  }

  // New: update page size buttons selection state
  private updatePageSizeButtons(): void {
    this.pageSizeButtons = [
      { label: '20', selected: this.pageSize === 20, action: () => this.applyPageSizeChange(20) },
      { label: '50', selected: this.pageSize === 50, action: () => this.applyPageSizeChange(50) },
      { label: '100', selected: this.pageSize === 100, action: () => this.applyPageSizeChange(100) },
    ];
  }

  onPageSizeChange(size: number): void {
    this.applyPageSizeChange(size);
  }

  // New: handler for page size button group click
  onPageSizeGroupClick(item: PoButtonGroupItem): void {
    const size = Number(item?.label);
    if ([20,50,100].includes(size)) {
      this.applyPageSizeChange(size);
    }
  }

  private applyPageSizeChange(size: number): void {
    this._pageSize = Number(size) || 50;
    this.page = 1;
    this.updatePagedItems();
    this.updatePaginationButtons();
    this.updatePageSizeButtons();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('titulos.pageSize', String(this._pageSize));
    }
  }

  private prevPage(): void { if (this.page > 1) { this.page--; this.updatePagedItems(); this.updatePaginationButtons(); } }
  private nextPage(): void { const last = this.totalPages; if (this.page < last) { this.page++; this.updatePagedItems(); this.updatePaginationButtons(); } }
  private goToPage(p: number): void { const last = this.totalPages; if (p < 1) p = 1; if (p > last) p = last; this.page = p; this.updatePagedItems(); this.updatePaginationButtons(); }

  clearFilters(): void { this.filters = {}; }

  openDetails(evt: any): void {
    const item = evt && evt.row ? (evt.row as TituloReceberDTO) : (evt as TituloReceberDTO);
    this.selected = item;
    this.showBaixaInput = false;
    this.baixaDate = undefined;
    this.detailsModal?.open();
  }

  startBaixa(): void {
    this.showBaixaInput = true;
    if (!this.baixaDate) this.baixaDate = new Date();
  }

  submitBaixa(): void {
    if (!this.baixaDate) {
      this.poNotification.warning('Informe a data de recebimento do cliente.');
      return;
    }
    if (!this.selected) {
      this.poNotification.warning('Nenhum título selecionado.');
      return;
    }
    // Garantir que a data está no tipo Date
    const dateObj = this.parseDateLoose(this.baixaDate);
    if (!dateObj) {
      this.poNotification.warning('Data de recebimento inválida. Use o formato dd/mm/aaaa.');
      return;
    }
    // Formatar para YYYYMMDD
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const yyyymmdd = `${y}${m}${d}`;

    const nf = String(this.selected.nf ?? '').trim();
    const parcela = String(this.selected.parcela ?? '').trim();
    if (!nf || !parcela) {
      this.poNotification.error('NF e parcela são obrigatórios para confirmar o recebimento.');
      return;
    }

    this.baixaSaving = true;
    this.service.confirmarRecebimento(nf, parcela, yyyymmdd).subscribe({
      next: (resp) => {
        if (resp?.ok) {
          // Atualiza UI localmente
          const dateIso = `${y}-${m}-${d}`; // manter apresentação yyyy-MM-dd
          (this.selected as any).dataRecebimentoCliente = dateIso;
          (this.selected as any).statusCanhotaRecebido = 'Baixado';
          this.poNotification.success('Baixa confirmada com sucesso.');
          this.showBaixaInput = false;
          this.detailsModal?.close();
          // Opcional: recarregar browse para refletir dados do servidor
          this.search();
        } else {
          const msg = resp?.data?.message || 'Falha ao confirmar recebimento.';
          this.poNotification.error(msg);
        }
        this.baixaSaving = false;
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Erro ao confirmar recebimento.';
        this.poNotification.error(msg);
        this.baixaSaving = false;
      }
    });
  }

  onTransportadoraChanged(val: any): void {
    const code = String(val ?? '').trim();
    if (code) {
      (this.filters as any).codigoTransportadora = code;
    } else {
      delete (this.filters as any).codigoTransportadora;
    }
    // Atualiza apenas o campo; a pesquisa é disparada pelo botão
  }

  onClienteChanged(val: any): void {
    const code = String(val ?? '').trim();
    if (code) {
      (this.filters as any).codigoCliente = code;
    } else {
      delete (this.filters as any).codigoCliente;
    }
    // Atualiza apenas o campo; a pesquisa é disparada pelo botão
  }

  private enrichTransportadoraNames(items: TituloReceberDTO[]): void {
    const codes = Array.from(new Set(items.map(it => String((it as any).codigoTransportadora ?? '').trim()).filter(c => !!c)));
    if (codes.length === 0) return;
    // Buscar detalhe por código (com token via interceptor) e preencher nome corretamente
    forkJoin(codes.map(code => this.transportadorasSvc.detail(code))).subscribe(results => {
      const nameByCode: Record<string, string> = {};
      results.forEach((dto, idx) => {
        const code = codes[idx];
        nameByCode[code] = dto?.nome ?? '';
      });
      items.forEach(it => {
        const code = String((it as any).codigoTransportadora ?? '').trim();
        if (code && nameByCode[code]) {
          (it as any).nomeTransportadora = nameByCode[code];
        }
      });
      this.updatePagedItems();
    });
  }

}














