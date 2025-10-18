import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PoPageModule, PoModalModule, PoModalComponent, PoTableModule, PoTableAction, PoNotificationService, PoNotificationModule, PoLoadingModule, PoTagModule, PoFieldModule } from '@po-ui/ng-components';
import { PoInfoModule, PoButtonGroupModule, PoButtonGroupItem } from '@po-ui/ng-components';
import { TitulosService, TituloFilters, TituloReceberDTO } from '../../core/titulos.service';
import { AuthService } from '../../core/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-titulos-receber',
  standalone: true,
  imports: [
    PoInfoModule,
    PoButtonGroupModule,
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
  <po-page-default p-title="Canhotos em aberto">
    <div class="filters">
      <po-input name="nf" p-label="Nota Fiscal" [(ngModel)]="filters.nf"></po-input>
      <po-input name="codigoCliente" p-label="Código Cliente" [(ngModel)]="filters.codigoCliente"></po-input>
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
        <button po-button p-label="Pesquisar" (click)="search()"></button>
        <button po-button p-type="secondary" p-label="Limpar" (click)="clearFilters()"></button>
        <button po-button p-type="link" p-label="Atualizar" (click)="search()"></button>
      </div>
    </div>

    <po-info p-label="Browse de Cadastro" p-value="Abaixo as informações dos Canhotos em aberto"></po-info>

    <div class="po-row">
      <po-button-group class="po-md-6" [p-buttons]="topButtons"> </po-button-group>
    </div>

    <po-loading *ngIf="loading"></po-loading>

    <po-table [p-auto-collapse]="true" [p-striped]="true" [p-sort]="true" [p-hide-table-search]="false" [p-actions-right]="true" [p-columns]="columns" [p-items]="pagedTitulos" [p-actions]="tableActions" (p-row-click)="openDetails($any($event))"></po-table>

    <div class="pagination">
      <po-button-group [p-buttons]="paginationButtons"></po-button-group>
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
        <button po-button p-label="Confirmar Recebimento" p-type="primary" (click)="startBaixa()"></button>
        <button po-button p-label="Fechar" p-type="secondary" (click)="detailsModal?.close()"></button>
      </div>
      <div class="baixa-form" *ngIf="showBaixaInput">
        <po-datepicker name="dataRecebimentoCliente" p-label="Data de Recebimento do Cliente" [(ngModel)]="baixaDate"></po-datepicker>
        <div class="modal-actions">
          <button po-button p-label="Salvar Baixa" p-type="primary" (click)="submitBaixa()"></button>
          <button po-button p-label="Fechar" p-type="secondary" (click)="detailsModal?.close()"></button>
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

  @ViewChild('detailsModal', { static: false }) detailsModal?: PoModalComponent;

  filters: TituloFilters = {};
  titulos: TituloReceberDTO[] = [];
  loading = false;
  selected?: TituloReceberDTO;
  showBaixaInput = false;
  baixaDate?: Date;

  // Paginação
  page = 1;
  pageSize = 50;
  totalItems = 0;
  pagedTitulos: TituloReceberDTO[] = [];
  paginationButtons: PoButtonGroupItem[] = [];

  get totalPages(): number { return Math.max(1, Math.ceil(this.totalItems / this.pageSize)); }

  columns = [
    { property: 'nf', label: 'NF' },
    { property: 'parcela', label: 'Parcela' },
    { property: 'codigoCliente', label: 'Cod. Cliente' },
    { property: 'dataEmissao', label: 'Emissão' },
    { property: 'dataVencimento', label: 'Vencimento' },
    { property: 'valor', label: 'Valor', type: 'currency', format: 'BRL' },
    { property: 'saldo', label: 'Saldo', type: 'currency', format: 'BRL' },
    { property: 'formaPagamento', label: 'Forma Pgto' },
    { property: 'statusCanhotaRecebido', label: 'Recebido' },
    { property: 'statusCanhotaRetorno', label: 'Retorno' },
  ];

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

    this.updatePaginationButtons();
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
        const filtered = this.filterItems(raw);
        const ordered = this.sortByVencimentoAsc(filtered);
        this.titulos = ordered;
        this.totalItems = ordered.length;
        this.page = 1;
        this.updatePagedItems();
        this.updatePaginationButtons();
        this.loading = false;
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
    return [...items].sort((a, b) => {
      const va = this.parseDateLoose(a.dataVencimento)?.getTime() ?? Number.POSITIVE_INFINITY;
      const vb = this.parseDateLoose(b.dataVencimento)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
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
    const dateStr = this.baixaDate.toISOString().substring(0, 10);
    if (this.selected) {
      (this.selected as any).dataRecebimentoCliente = dateStr;
      (this.selected as any).statusCanhotaRecebido = 'Baixado';
    }
    this.poNotification.success('Baixa confirmada.');
    this.showBaixaInput = false;
    this.detailsModal?.close();
  }
}














