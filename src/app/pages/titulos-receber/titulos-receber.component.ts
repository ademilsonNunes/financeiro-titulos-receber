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
      <po-input name="nomeCliente" p-label="Nome Cliente" [(ngModel)]="filters.nomeCliente"></po-input>
      <po-select name="uf" p-label="UF" [p-options]="ufs" [ngModel]="filters.uf" (ngModelChange)="filters.uf = $event"></po-select>
      <po-input name="municipio" p-label="Município" [(ngModel)]="filters.municipio"></po-input>
      <po-input name="vendedor" p-label="Vendedor" [(ngModel)]="filters.vendedor"></po-input>
      <po-input name="formaPagamento" p-label="Forma de Pagamento" [(ngModel)]="filters.formaPagamento"></po-input>
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

    <po-table [p-auto-collapse]="true" [p-striped]="true" [p-sort]="true" [p-hide-table-search]="false" [p-actions-right]="true" [p-columns]="columns" [p-items]="titulos" [p-actions]="tableActions" (p-row-click)="openDetails($any($event))"></po-table>

    <po-modal #detailsModal p-title="Detalhes do Título">
      <div class="details-content" *ngIf="selected">
        <div class="row"><strong>NF:</strong> {{ selected.nf }} | <strong>Parcela:</strong> {{ selected.parcela }}</div>
        <div class="row"><strong>Cliente:</strong> {{ selected.codigoCliente }} - {{ selected.nomeCliente }}</div>
        <div class="row"><strong>Valor:</strong> {{ selected.valor | currency:'BRL':'symbol-narrow' }} | <strong>Saldo:</strong> {{ selected.saldo | currency:'BRL':'symbol-narrow' }}</div>
        <div class="row"><strong>Emissão:</strong> {{ selected.dataEmissao }} | <strong>Vencimento:</strong> {{ selected.dataVencimento }}</div>
        <div class="row"><strong>Forma Pagamento:</strong> {{ selected.formaPagamento }} | <strong>Condição:</strong> {{ selected.condicaoPagamento }}</div>
        <div class="row"><strong>UF:</strong> {{ selected.uf }} | <strong>Município:</strong> {{ selected.municipio }}</div>
        <div class="row"><strong>Status Recebido:</strong> <po-tag [p-value]="selected.statusCanhotaRecebido"></po-tag></div>
        <div class="row"><strong>Status Retorno:</strong> <po-tag [p-value]="selected.statusCanhotaRetorno"></po-tag></div>
        <div class="row"><strong>Chave NFe:</strong> {{ selected.chaveNFe }}</div>
      </div>
      <div class="modal-actions">
        <button po-button p-label="Confirmar Baixa" p-type="primary" (click)="confirmBaixa()"></button>
        <button po-button p-label="Cancelar Baixa" p-type="danger" (click)="cancelBaixa()"></button>
        <button po-button p-label="Fechar" p-type="secondary" (click)="detailsModal?.close()"></button>
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
  ufs = [
    { label: 'AC', value: 'AC' }, { label: 'AL', value: 'AL' }, { label: 'AP', value: 'AP' },
    { label: 'AM', value: 'AM' }, { label: 'BA', value: 'BA' }, { label: 'CE', value: 'CE' },
    { label: 'DF', value: 'DF' }, { label: 'ES', value: 'ES' }, { label: 'GO', value: 'GO' },
    { label: 'MA', value: 'MA' }, { label: 'MG', value: 'MG' }, { label: 'MS', value: 'MS' },
    { label: 'MT', value: 'MT' }, { label: 'PA', value: 'PA' }, { label: 'PB', value: 'PB' },
    { label: 'PE', value: 'PE' }, { label: 'PI', value: 'PI' }, { label: 'PR', value: 'PR' },
    { label: 'RJ', value: 'RJ' }, { label: 'RN', value: 'RN' }, { label: 'RO', value: 'RO' },
    { label: 'RR', value: 'RR' }, { label: 'RS', value: 'RS' }, { label: 'SC', value: 'SC' },
    { label: 'SE', value: 'SE' }, { label: 'SP', value: 'SP' }, { label: 'TO', value: 'TO' },
  ];

  columns = [
    { property: 'nf', label: 'NF' },
    { property: 'parcela', label: 'Parcela' },
    { property: 'codigoCliente', label: 'Cod. Cliente' },
    { property: 'nomeCliente', label: 'Cliente' },
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
    // Pesquisa automaticamente se jÃ¡ houver token e tambÃ©m quando um novo token for definido
    if (this.authService.getToken()) {
      this.search();
    } else {
      this.poNotification.information('Defina o token no menu "Definir Token" para carregar a listagem.');
    }

    this.authService.token$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(t => { if (t) this.search(); });
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
        this.titulos = data ?? [];
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.poNotification.error('Erro ao buscar tÃ­tulos');
        console.error(err);
      }
    });
  }

  clearFilters(): void { this.filters = {}; }

  openDetails(evt: any): void {
    const item = evt && evt.row ? (evt.row as TituloReceberDTO) : (evt as TituloReceberDTO);
    this.selected = item;
    this.detailsModal?.open();
  }

  confirmBaixa(): void { this.poNotification.success('Baixa confirmada (aÃ§Ã£o a implementar)'); }

  cancelBaixa(): void { this.poNotification.warning('Baixa cancelada (aÃ§Ã£o a implementar)'); }
}














