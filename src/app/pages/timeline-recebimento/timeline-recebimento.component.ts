import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  PoChartModule,
  PoInfoModule,
  PoLoadingModule,
  PoPageModule,
  PoTableColumn,
  PoTableModule,
  PoTagModule,
  PoWidgetModule,
  PoTableColumnSort,
  PoTableColumnSortType,
  PoChartType,
  PoTagType,
  PoButtonModule,
  PoFieldModule,
  PoSelectOption
} from '@po-ui/ng-components';
import { TimelineRecebimentoItem, TimelineRecebimentoService } from '../../core/timeline-recebimento.service';
import type { PoTableSubtitleColumn } from '@po-ui/ng-components';
import { AuthService } from '../../core/auth.service';

// Using PoTagType from @po-ui/ng-components

interface DashboardViewItem {
  nf: string;
  parcela: string;
  cliente: string;
  uf: string;
  municipio?: string;
  vendedor?: string;
  valor: number;
  saldo: number;
  prioridade: string;
  statusGeral: string;
  faixaAging: string;
  diasEmAtraso: number;
  diasParaVencimento: number;
  diasDesdeEmissao: number;
  proximaAcao: string;
  chaveNFe?: string;
}

interface PriorityOverviewItem {
  prioridade: string;
  quantidade: number;
  saldo: number;
}

interface UfSaldoResumo {
  uf: string;
  saldo: number;
  percentual: number;
}

interface EnrichedItem extends DashboardViewItem {
  score: number;
}

@Component({
  selector: 'app-timeline-recebimento',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PoPageModule,
    PoInfoModule,
    PoLoadingModule,
    PoTagModule,
    PoTableModule,
    PoChartModule,
    PoWidgetModule,
    PoButtonModule,
    PoFieldModule,
  ],
  template: `
  <po-page-default p-title="Dashboard de Recebimento" p-size="auto" [attr.aria-busy]="loading">
    <po-loading *ngIf="loading"></po-loading>

    <ng-container *ngIf="!loading && items.length">
      <section class="summary-grid" role="region" aria-label="Indicadores gerais">

        <po-info p-label="Valor faturado" [p-value]="formatCurrency(valorTotal)"></po-info>
        <po-info p-label="Saldo pendente" [p-value]="formatCurrency(saldoTotal)"></po-info>

        <po-info p-label="Ticket médio" [p-value]="formatCurrency(ticketMedio)"></po-info>
        <po-info p-label="Maior atraso" [p-value]="formatDays(maiorAtraso)"></po-info>
        <po-info p-label="Lead time médio" [p-value]="formatNumber(leadTimeMedio, 1) + ' dias'"></po-info>

        <po-info p-label="Aguardando confirmação" [p-value]="formatNumber(aguardandoConfirmacao)"></po-info>
        <po-info p-label="Saldo em confirmação" [p-value]="formatCurrency(saldoEmConfirmacao)"></po-info>
        <po-info p-label="% dentro do SLA (confirmação)" [p-value]="formatPercent(percentualConfirmacaoSLA)"></po-info>
      </section>

      <section class="insights-grid" role="region" aria-label="Insights rápidos">
        <po-widget p-title="Maior risco (confirmação)" *ngIf="topPriorityCard">
          <div class="insight">
            <div class="insight-title">{{ topPriorityCard.nf }} • {{ topPriorityCard.cliente }}</div>
            <div class="insight-subtitle">Saldo {{ formatCurrency(topPriorityCard.saldo || 0) }}</div>
            <po-tag [p-type]="resolveTagType(topPriorityCard.prioridade)" [p-value]="topPriorityCard.prioridade || ''"></po-tag>
            <small>{{ topPriorityCard.proximaAcao }}</small>
          </div>
        </po-widget>

        <po-widget p-title="Maior backlog por UF (confirmação)" *ngIf="ufComMaiorSaldo">
          <div class="insight">
            <div class="insight-title">{{ ufComMaiorSaldo.uf }}</div>
            <div class="insight-subtitle">Saldo {{ formatCurrency(ufComMaiorSaldo.saldo || 0) }}</div>
            <small>Equivale a {{ formatPercent(ufComMaiorSaldo.percentual || 0) }} do saldo total</small>
          </div>
        </po-widget>

        <po-widget p-title="Prioridades da confirmação">
          <div class="tag-list" *ngIf="priorityOverview.length; else noPriority">
            <div class="tag-row" *ngFor="let prioridade of priorityOverview">
              <po-tag [p-type]="resolveTagType(prioridade.prioridade)" [p-value]="prioridade.prioridade"></po-tag>
              <div class="tag-row-info">
                <strong>{{ formatNumber(prioridade.quantidade) }} títulos</strong>
                <small>{{ formatCurrency(prioridade.saldo) }} em aberto</small>
              </div>
            </div>
          </div>
          <ng-template #noPriority>
            <small>Nenhuma prioridade pendente.</small>
          </ng-template>
        </po-widget>
      </section>

      <section class="charts-grid" role="region" aria-label="Visões analíticas">
        <div class="chart-card">
          <header>Backlog de confirmação por UF</header>
          <po-chart [p-type]="chartTypeColumn" [p-series]="ufSeries" [p-categories]="ufCategories" [p-height]="260"></po-chart>
        </div>
        <div class="chart-card">
          <header>Distribuição dos títulos em confirmação por status</header>
          <po-chart 
            [p-type]="chartTypeBar" 
            [p-series]="statusSeries" 
            [p-categories]="statusCategories" 
            [p-height]="260"
            [p-options]="statusChartOptions">
          </po-chart>
        </div>
        <div class="chart-card chart-card--full">
          <header>Distribuição da Carteira por Faixa de Atraso</header>
          <po-chart [p-type]="chartTypeBar" [p-series]="agingSeries" [p-categories]="agingCategories" [p-height]="300"></po-chart>
          <po-table [p-columns]="agingResumoColumns" [p-items]="agingResumoItems"></po-table>
        </div>
      </section>

      <section class="prioridades" role="region" aria-label="Fila de prioridades">
        <div class="section-header">
          <h3>Fila de Prioridades (confirmação)</h3>
          <div class="pagination">
            <po-button p-label="Anterior" (p-click)="goPrev('priority')" [p-disabled]="priorityPageIndex <= 1"></po-button>
            <po-button p-label="Próxima" (p-click)="goNext('priority')" [p-disabled]="priorityPageIndex >= priorityTotalPages"></po-button>
            <div class="page-info">Página {{ priorityPageIndex }} de {{ priorityTotalPages }}</div>
            <div class="page-size">
              <po-select [p-options]="pageSizeOptions" [formControl]="priorityPageSizeCtrl"></po-select>
            </div>
          </div>
          <div class="sort-status">
            Ordenando por: <strong>{{ getSortLabel('priority') }}</strong> • {{ prioritySortAsc ? 'Crescente' : 'Descendente' }}
            <po-button p-label="Inverter" p-type="secondary" (p-click)="toggleSortDirection('priority')"></po-button>
          </div>
          <div class="legend-bar" aria-label="Legenda de Status e Prioridade">
            <div class="legend-group-inline">
              <span class="legend-label">Status geral:</span>
              <span class="legend-item" *ngFor="let s of statusLegend">
                <span class="legend-dot" [ngClass]="legendClassForStatus(s.key)"></span>
                <span class="legend-text">{{ s.label }}</span>
              </span>
            </div>
            <div class="legend-group-inline">
              <span class="legend-label">Prioridade:</span>
              <span class="legend-item" *ngFor="let p of priorityLegend">
                <span class="legend-dot" [ngClass]="legendClassForPriority(p.key)"></span>
                <span class="legend-text">{{ p.label }}</span>
              </span>
            </div>
          </div>
        </div>
        <po-table [p-columns]="priorityColumns" [p-items]="priorityPaginatedItems" (p-sort)="onSort($event, 'priority')"></po-table>
      </section>

      <section class="aging-board" role="region" aria-label="Carteira por aging">
        <div class="section-header">
          <h3>Carteira por Aging</h3>
          <div class="pagination">
            <po-button p-label="Anterior" (p-click)="goPrev('aging')" [p-disabled]="agingPageIndex <= 1"></po-button>
            <po-button p-label="Próxima" (p-click)="goNext('aging')" [p-disabled]="agingPageIndex >= agingTotalPages"></po-button>
            <div class="page-info">Página {{ agingPageIndex }} de {{ agingTotalPages }}</div>
            <div class="page-size">
              <po-select [p-options]="pageSizeOptions" [formControl]="agingPageSizeCtrl"></po-select>
            </div>
          </div>
          <div class="sort-status">
            Ordenando por: <strong>{{ getSortLabel('aging') }}</strong> • {{ agingSortAsc ? 'Crescente' : 'Descendente' }}
            <po-button p-label="Inverter" p-type="secondary" (p-click)="toggleSortDirection('aging')"></po-button>
          </div>
          <div class="legend-bar" aria-label="Legenda de Status e Prioridade">
            <div class="legend-group-inline">
              <span class="legend-label">Status geral:</span>
              <span class="legend-item" *ngFor="let s of statusLegend">
                <span class="legend-dot" [ngClass]="legendClassForStatus(s.key)"></span>
                <span class="legend-text">{{ s.label }}</span>
              </span>
            </div>
            <div class="legend-group-inline">
              <span class="legend-label">Prioridade:</span>
              <span class="legend-item" *ngFor="let p of priorityLegend">
                <span class="legend-dot" [ngClass]="legendClassForPriority(p.key)"></span>
                <span class="legend-text">{{ p.label }}</span>
              </span>
            </div>
          </div>
        </div>
        <po-table [p-columns]="agingColumns" [p-items]="agingPaginatedItems" (p-sort)="onSort($event, 'aging')"></po-table>
      </section>

      <ng-container *ngIf="!loading && !items.length">
        <section class="empty-state" role="region" aria-label="Sem dados">
          <po-info p-label="Sem dados" [p-value]="'Não há títulos para exibir no momento.'"></po-info>
        </section>
      </ng-container>
  `,
  styleUrls: ['./timeline-recebimento.component.scss']
})
export class TimelineRecebimentoComponent implements OnInit {
  private service = inject(TimelineRecebimentoService);
  private auth = inject(AuthService);

  // Tabelas e itens utilizados no template
  agingColumns: PoTableColumn[] = [];
  priorityColumns: PoTableColumn[] = [];
  agingItems: DashboardViewItem[] = [];
  priorityItems: DashboardViewItem[] = [];
  agingPaginatedItems: DashboardViewItem[] = [];
  priorityPaginatedItems: DashboardViewItem[] = [];

  loading = false;
  items: TimelineRecebimentoItem[] = [];

  chartTypeBar: PoChartType = PoChartType.Bar;
  chartTypeColumn: PoChartType = PoChartType.Column;
  chartTypeDonut: PoChartType = PoChartType.Donut;

  total = 0;
  valorTotal = 0;
  saldoTotal = 0;
  pendentes = 0;
  atrasados = 0;
  baixados = 0;
  ticketMedio = 0;
  percentualBaixados = 0;
  leadTimeMedio = 0;
  maiorAtraso = 0;
  ultimaAtualizacao: string | null = null;

  // Indicadores focados em confirmação de entrega
  aguardandoConfirmacao = 0;
  saldoEmConfirmacao = 0;
  percentualConfirmacaoSLA = 0;
  ufCategories: string[] = [];
  ufSeries: Array<{ name: string; data: number[] }> = [];

  statusCategories: string[] = [];
  statusSeries: Array<{ name: string; data: number[] }> = [];
  statusChartOptions: any = {
    xAxis: {
      title: {
        text: 'Quantidade de Títulos'
      },
      labels: {
        formatter: function(this: any) {
          return this.value.toString();
        }
      }
    },
    yAxis: {
      title: {
        text: 'Status'
      }
    },
    tooltip: {
      formatter: function(this: any) {
        return `<b>${this.y}</b>: ${this.x} títulos`;
      }
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true,
          formatter: function(this: any) {
            return this.y.toString();
          }
        }
      }
    }
  };

  agingCategories: string[] = [];
  agingSeries: Array<{ name: string; data: number[] }> = [];
  agingResumoColumns: PoTableColumn[] = [
    { property: 'faixa', label: 'Faixa de Atraso (dias)' },
    { property: 'quantidade', label: 'Quantidade de Títulos', type: 'number' },
    { property: 'valorInicial', label: 'Valor Inicial', type: 'currency', format: 'BRL' },
    // Removido: { property: 'valorCorrigido', label: 'Valor Corrigido', type: 'currency', format: 'BRL' },
  ];
  agingResumoItems: Array<{ faixa: string; quantidade: number; valorInicial: number }> = [];

  pageSizeOptions: PoSelectOption[] = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 },
  ];

  agingPageIndex = 1;
  agingPageSize = 10;
  priorityPageIndex = 1;
  priorityPageSize = 10;
  agingPageSizeCtrl = new FormControl<number>(10, { nonNullable: true });
  priorityPageSizeCtrl = new FormControl<number>(10, { nonNullable: true });

  // Legendas compactas (status geral e prioridade)
  statusLegend = [
    { key: 'CRÍTICO', label: 'Crítico' },
    { key: 'EM_ATRASO', label: 'Em atraso' },
    { key: 'PENDENTE', label: 'Pendente' },
    { key: 'REGULARIZADO', label: 'Regularizado / Monitoramento' },
    { key: 'EM_DIA', label: 'Em dia' }
  ];

  priorityLegend = [
    { key: 'CRÍTICA', label: 'Crítica' },
    { key: 'ALTA', label: 'Alta' },
    { key: 'MÉDIA', label: 'Média' },
    { key: 'BAIXA', label: 'Baixa' }
  ];

  legendClassForStatus = (key: string) => this.tagTypeToClass(this.resolveStatusTagType(key));
  legendClassForPriority = (key: string) => this.tagTypeToClass(this.resolveTagType(key));

  private tagTypeToClass(type: PoTagType): string {
    switch (type) {
      case PoTagType.Success:
        return 'success';
      case PoTagType.Warning:
        return 'warning';
      case PoTagType.Danger:
        return 'danger';
      case PoTagType.Info:
        return 'info';
      default:
        return 'neutral';
    }
  }

  get agingTotalPages(): number {
    return Math.max(1, Math.ceil(this.agingItems.length / this.agingPageSize));
  }
  get priorityTotalPages(): number {
    return Math.max(1, Math.ceil(this.priorityItems.length / this.priorityPageSize));
  }

  get agingFromIndex(): number {
    return this.agingItems.length ? (this.agingPageIndex - 1) * this.agingPageSize : 0;
  }
  get agingToIndex(): number {
    return Math.min(this.agingItems.length, this.agingFromIndex + this.agingPageSize);
  }

  get priorityFromIndex(): number {
    return this.priorityItems.length ? (this.priorityPageIndex - 1) * this.priorityPageSize : 0;
  }
  get priorityToIndex(): number {
    return Math.min(this.priorityItems.length, this.priorityFromIndex + this.priorityPageSize);
  }

  priorityDonutSeries: Array<{ label: string; data: number }> = [];
  priorityDonutLegend: Array<{ label: string; count: number; pct: number }> = [];

  priorityOverview: PriorityOverviewItem[] = [];
  ufComMaiorSaldo?: UfSaldoResumo;
  topPriorityCard: DashboardViewItem | null = null;

  // Estado de ordenação atual (UX)
  prioritySortProp: keyof DashboardViewItem = 'diasEmAtraso' as any;
  prioritySortAsc = false;
  agingSortProp: keyof DashboardViewItem = 'diasEmAtraso' as any;
  agingSortAsc = false;

  private propertyLabelMap: Record<string, string> = {
    nf: 'NF',
    parcela: 'Parcela',
    cliente: 'Cliente',
    uf: 'UF',
    prioridade: 'Prioridade',
    statusGeral: 'Status',
    faixaAging: 'Faixa aging',
    diasEmAtraso: 'Dias em atraso',
    diasDesdeEmissao: 'Dias da emissão',
    diasParaVencimento: 'Dias p/ vencimento',
    valor: 'Valor',
    saldo: 'Saldo',
    proximaAcao: 'Próxima ação'
  };

  getSortLabel(table: 'aging' | 'priority'): string {
    const prop = table === 'aging' ? this.agingSortProp : this.prioritySortProp;
    return this.propertyLabelMap[String(prop)] || String(prop);
  }

  prioritySubtitles: PoTableSubtitleColumn[] = [
    { value: 'CRÍTICA', color: 'color-07', label: 'Crítica', content: 'Crítica' },
    { value: 'ALTA', color: 'color-08', label: 'Alta', content: 'Alta' },
    { value: 'MÉDIA', color: 'color-02', label: 'Média', content: 'Média' },
    { value: 'BAIXA', color: 'color-10', label: 'Baixa', content: 'Baixa' },
  ];

  statusSubtitles: PoTableSubtitleColumn[] = [
    { value: 'EM_DIA', color: 'color-10', label: 'Em dia', content: 'Em dia' },
    { value: 'EM_ATRASO', color: 'color-08', label: 'Em atraso', content: 'Em atraso' },
    { value: 'CRÍTICO', color: 'color-07', label: 'Crítico', content: 'Crítico' },
    { value: 'PENDENTE', color: 'color-03', label: 'Pendente', content: 'Pendente' },
    { value: 'REGULARIZADO', color: 'color-11', label: 'Regularizado / Monitoramento', content: 'Regularizado / Monitoramento' },
  ];

  faixaSubtitles: PoTableSubtitleColumn[] = [
    { value: 'A_VENCER', color: 'color-10', label: 'A vencer', content: 'A vencer' },
    { value: 'EM_DIA', color: 'color-11', label: 'Em dia', content: 'Em dia' },
    { value: 'EM_ATRASO', color: 'color-08', label: 'Em atraso', content: 'Em atraso' },
    { value: 'VENCIDO', color: 'color-07', label: 'Vencido', content: 'Vencido' },
    { value: 'SEM_CLASSIFICACAO', color: 'color-03', label: 'Não classificado', content: 'Não classificado' },
  ];

  ngOnInit(): void {
    // sincroniza selects reativos de paginação
    this.agingPageSizeCtrl.setValue(this.agingPageSize, { emitEvent: false });
    this.priorityPageSizeCtrl.setValue(this.priorityPageSize, { emitEvent: false });
    this.agingPageSizeCtrl.valueChanges.subscribe(value => {
      this.agingPageSize = value ?? 10;
      this.agingPageIndex = 1;
      this.updatePagination('aging');
    });
    this.priorityPageSizeCtrl.valueChanges.subscribe(value => {
      this.priorityPageSize = value ?? 10;
      this.priorityPageIndex = 1;
      this.updatePagination('priority');
    });

    this.priorityColumns = this.createPriorityColumns();
    this.agingColumns = this.createAgingColumns();

    // Aguarda token antes de buscar dados (evita 401 na primeira carga)
    const currentToken = this.auth.getToken();
    if (currentToken) {
      this.fetchData();
    } else {
      // Tenta obter token automaticamente (dev) e busca ao concluir
      this.auth.refreshDevTokenIfConfigured().subscribe({
        next: () => this.fetchData(),
        error: () => this.fetchData(), // em último caso tenta mesmo assim (pode ser que o back permita sem token)
      });
    }

    // Recarrega quando um novo token for definido manualmente pelo usuário
    (this.auth as any).token$?.subscribe((t: string | null) => {
      if (t) this.fetchData();
    });

    // Ordenação padrão: Dias em atraso DESC em ambas as tabelas
    this.applyCurrentSort('priority');
    this.applyCurrentSort('aging');
  }

  private createPriorityColumns(): PoTableColumn[] {
    return [
      { property: 'nf', label: 'NF', width: '80px' },
      { property: 'parcela', label: 'Parcela', width: '80px' },
      { property: 'cliente', label: 'Cliente' },
      { property: 'uf', label: 'UF', width: '60px' },
      { property: 'prioridade', label: 'Prioridade', type: 'subtitle', subtitles: this.prioritySubtitles, width: '160px' },
      { property: 'statusGeral', label: 'Status geral', type: 'subtitle', subtitles: this.statusSubtitles, width: '160px' },
      { property: 'diasEmAtraso', label: 'Dias atraso', type: 'number', width: '120px' },
      { property: 'valor', label: 'Valor', type: 'currency', format: 'BRL' },
      { property: 'saldo', label: 'Saldo', type: 'currency', format: 'BRL' },
      { property: 'proximaAcao', label: 'Próxima ação' },
    ];
  }

  private createAgingColumns(): PoTableColumn[] {
    return [
      { property: 'nf', label: 'NF', width: '80px' },
      { property: 'parcela', label: 'Parcela', width: '80px' },
      { property: 'cliente', label: 'Cliente' },
      { property: 'uf', label: 'UF', width: '60px' },
      { property: 'faixaAging', label: 'Faixa aging', type: 'subtitle', subtitles: this.faixaSubtitles, width: '140px' },
      { property: 'statusGeral', label: 'Status geral', type: 'subtitle', subtitles: this.statusSubtitles, width: '160px' },
      { property: 'prioridade', label: 'Prioridade', type: 'subtitle', subtitles: this.prioritySubtitles, width: '160px' },
      { property: 'diasDesdeEmissao', label: 'Dias da emissão', type: 'number', width: '140px' },
      { property: 'diasParaVencimento', label: 'Dias p/ vencimento', type: 'number', width: '160px' },
      { property: 'diasEmAtraso', label: 'Dias em atraso', type: 'number', width: '140px' },
      { property: 'valor', label: 'Valor', type: 'currency', format: 'BRL' },
      { property: 'saldo', label: 'Saldo', type: 'currency', format: 'BRL' },
      { property: 'proximaAcao', label: 'Próxima ação' },
    ];
  }

  private enrichItem(item: TimelineRecebimentoItem): EnrichedItem {
    const aging = (item.aging || {}) as Record<string, any>;
    const saldo = Number(item.saldo ?? 0);
    const valor = Number(item.valor ?? saldo);
    // Normaliza e corrige a próxima ação: "Aguardando baixa financeira" -> "Aguardando confirmação de entrega"
    let proximaAcao = (item as any)['proximaAcao']?.descricao || '';
    const acaoNorm = String(proximaAcao || '').toUpperCase();
    if (acaoNorm.includes('AGUARDANDO BAIXA FINANCEIRA')) {
      proximaAcao = 'Aguardando confirmação de entrega';
    }

    // Fator Cliente (10 = estratégico, 5 = regular, 15 = histórico ruim)
    const fatorCliente = Number((item as any)['fatorCliente'] ?? 5);

    // Calcula prioridade pela regra e pelo score, depois toma a mais severa
    const prioridadeRegra = this.inferPriority(aging, saldo, valor, fatorCliente);

    // Score = (Dias Atraso × 3) + (Valor/1000 × 2) + (Fator Cliente × 1)
    const diasEmAtraso = this.getDiasEmAtraso(aging);
    const scoreCalc = (diasEmAtraso * 3) + ((valor / 1000) * 2) + (fatorCliente * 1);
    const prioridadeScore = this.priorityFromScore(scoreCalc);

    const prioridade = this.normalizePriority((item as any)['proximaAcao']?.prioridade || this.higherPriority(prioridadeRegra, prioridadeScore));
    const statusGeral = this.computeStatus(aging, prioridade, proximaAcao);
    const faixaAging = this.normalizeFaixa(aging['faixaAging']);
    const diasParaVencimento = Number(aging['diasParaVencimento'] ?? 0);
    const diasDesdeEmissao = Number(aging['diasDesdeEmissao'] ?? 0);

    // Score usado para ordenação das filas (mantém compatibilidade)
    let score = scoreCalc;
    const rank = this.priorityRank(prioridade);
    score += rank * 100000;
    if (this.isBaixado(item)) {
      score = -Infinity;
    }

    return {
      nf: String(item.nf || ''),
      parcela: String(item.parcela || ''),
      cliente: String(item.nomeCliente || ''),
      uf: String(item.uf || 'N/D'),
      municipio: item.municipio,
      vendedor: item.vendedor,
      valor,
      saldo,
      prioridade,
      statusGeral,
      faixaAging,
      diasEmAtraso,
      diasParaVencimento,
      diasDesdeEmissao,
      proximaAcao,
      chaveNFe: item.chaveNFe,
      score,
    };
  }

  private getDiasEmAtraso(aging?: Record<string, any>): number {
    if (!aging) {
      return 0;
    }
    const raw = aging['diasEmAtraso'] ?? aging['diasDesdeVencimento'] ?? aging['diasAtraso'];
    return Number(raw ?? 0) || 0;
  }

  private isBaixado(it: TimelineRecebimentoItem): boolean {
    const received = String(it.statusCanhotaRecebido || '').toLowerCase();
    const retorno = String(it.statusCanhotaRetorno || '').toLowerCase();
    return received.includes('baix') || retorno.includes('baix');
  }

  private inferPriority(aging: Record<string, any>, saldo: number, valor?: number, fatorCliente?: number): string {
    const diasAtraso = this.getDiasEmAtraso(aging);
    const v = Number(valor ?? saldo ?? 0);
    const fc = Number(fatorCliente ?? 5);

    // Regras alinhadas ao escopo do usuário:
    // CRÍTICA: atraso ≥ 30 OU valor ≥ 50k OU cliente com histórico ruim (fc ≥ 15)
    if (diasAtraso >= 30 || v >= 50_000 || fc >= 15) {
      return 'CRÍTICA';
    }

    // ALTA: atraso 15–29 OU valor 20k–49,999 OU cliente estratégico (fc = 10)
    if ((diasAtraso >= 15 && diasAtraso <= 29) || (v >= 20_000 && v <= 49_999) || fc === 10) {
      return 'ALTA';
    }

    // MÉDIA: atraso 8–14 OU valor 10k–19,999
    if ((diasAtraso >= 8 && diasAtraso <= 14) || (v >= 10_000 && v <= 19_999)) {
      return 'MÉDIA';
    }

    // BAIXA: atraso 1–7 OU valor < 10k (sem atraso cai aqui também)
    if ((diasAtraso >= 1 && diasAtraso <= 7) || v < 10_000) {
      return 'BAIXA';
    }

    // Em caso de 0 dias e sem regras acima, manter BAIXA
    return 'BAIXA';
  }

  private normalizePriority(priority?: string | null): string {
    const normalized = this.normalizeBase(priority);
    switch (normalized) {
      case 'CRITICA':
      case 'CRITICO':
        return 'CRÍTICA';
      case 'ALTA':
        return 'ALTA';
      case 'MEDIA':
        return 'MÉDIA';
      case 'BAIXA':
        return 'BAIXA';
      case 'SEM_CLASSIFICACAO':
        return 'BAIXA';
      default:
        return normalized || 'BAIXA';
    }
  }

  private normalizeStatus(status?: string | null): string {
    const normalized = this.normalizeBase(status);
    switch (normalized) {
      case 'EM_ATRASO':
        return 'EM_ATRASO';
      case 'EM_DIA':
        return 'EM_DIA';
      case 'CRITICO':
      case 'CRITICA':
        return 'CRÍTICO';
      case 'REGULARIZADO':
        return 'REGULARIZADO';
      case 'PENDENTE':
        return 'PENDENTE';
      default:
        return normalized || 'PENDENTE';
    }
  }

  private computeStatus(aging: Record<string, any>, prioridade: string, proximaAcao: string): string {
    const diasAtraso = this.getDiasEmAtraso(aging);
    const diasParaVencimento = Number(aging['diasParaVencimento'] ?? 0);
    const prio = this.normalizePriority(prioridade);
    const acao = this.normalizeBase(proximaAcao);

    // Regras atualizadas de Status Geral
    // - CRÍTICO: atraso ≥ 61 dias ou prioridade CRÍTICA
    // - EM_ATRASO: atraso > 0 (até 60 dias)
    // - PENDENTE: sem atraso, porém requer ação (ex.: aguardando confirmação de entrega)
    // - REGULARIZADO: processo de baixa/recebimento em andamento
    // - EM_DIA: demais casos
    if (prio === 'CRÍTICA' || diasAtraso >= 61) {
      return 'CRÍTICO';
    }
    if (diasAtraso > 0) {
      return 'EM_ATRASO';
    }
    if (acao.includes('AGUARDANDO CONFIRMACAO DE ENTREGA') || acao.includes('CONFIRMACAO DE ENTREGA')) {
      return 'PENDENTE';
    }
    if (acao.includes('AGUARDANDO BAIXA')) {
      return 'REGULARIZADO';
    }
    if (diasParaVencimento > 0 && diasParaVencimento <= 3) {
      return 'PENDENTE';
    }
    return 'EM_DIA';
  }

  private normalizeFaixa(faixa?: string | null): string {
    const normalized = this.normalizeBase(faixa);
    switch (normalized) {
      case 'A_VENCER':
      case 'AVENCER':
        return 'A_VENCER';
      case 'EM_ATRASO':
        return 'EM_ATRASO';
      case 'EM_DIA':
      case 'EMDIA':
        return 'EM_DIA';
      case 'VENCIDO':
      case 'VENCIDOS':
        return 'VENCIDO';
      case '':
        return 'SEM_CLASSIFICACAO';
      default:
        return normalized;
    }
  }

  private fetchData(): void {
    this.loading = true;
    this.service.list().subscribe({
      next: (arr) => {
        this.items = Array.isArray(arr) ? arr : [];
        this.computeSummary();
        this.buildAnalytics();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private computeSummary(): void {
    this.total = this.items.length;
    const sumReducer = (acc: number, value?: number) => acc + (Number(value) || 0);
    this.valorTotal = this.items.reduce((acc, it) => sumReducer(acc, it.valor), 0);
    this.saldoTotal = this.items.reduce((acc, it) => sumReducer(acc, it.saldo), 0);

    const baixadoPredicate = (it: TimelineRecebimentoItem) => this.isBaixado(it);
    this.baixados = this.items.filter(baixadoPredicate).length;
    const pend = this.items.filter(it => !baixadoPredicate(it));
    this.pendentes = pend.length;
    this.percentualBaixados = this.total ? (this.baixados / this.total) * 100 : 0;

    const diasAtrasoList = this.items.map(it => this.getDiasEmAtraso(it.aging));
    this.atrasados = pend.filter(it => this.getDiasEmAtraso(it.aging) > 0).length;
    this.maiorAtraso = Math.max(0, ...diasAtrasoList);

    const diasDesdeEmissaoList = this.items.map(it => Number((it.aging || {})['diasDesdeEmissao'] ?? 0));
    const somaDias = diasDesdeEmissaoList.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
    this.leadTimeMedio = diasDesdeEmissaoList.length ? somaDias / diasDesdeEmissaoList.length : 0;

    this.ticketMedio = this.total ? this.valorTotal / this.total : 0;

    this.ultimaAtualizacao = this.computeUltimaAtualizacao();
  }

  private buildAnalytics(): void {
    const enriched = this.items
      .filter(item => !this.isBaixado(item))
      .map(item => this.enrichItem(item));

    // Métricas focadas em confirmação de entrega
    const confirmacaoItems = enriched.filter(it => this.normalizeBase(it.proximaAcao).includes('CONFIRMACAO DE ENTREGA'));
    this.aguardandoConfirmacao = confirmacaoItems.length;
    this.saldoEmConfirmacao = confirmacaoItems.reduce((acc, it) => acc + (it.saldo || 0), 0);
    const dentroSLA = confirmacaoItems.filter(it => (it.diasEmAtraso <= 0) && (it.diasParaVencimento > 3)).length;
    this.percentualConfirmacaoSLA = confirmacaoItems.length ? (dentroSLA / confirmacaoItems.length) * 100 : 0;

    this.buildCharts(enriched);

    // Popular tabelas detalhadas
    this.buildPriorities(enriched);
    this.buildAgingList(enriched);

    // Aplicar ordenação padrão
    this.prioritySortProp = 'diasEmAtraso' as any; this.prioritySortAsc = false;
    this.agingSortProp = 'diasEmAtraso' as any; this.agingSortAsc = false;
    this.applyCurrentSort('priority');
    this.applyCurrentSort('aging');
  }

  private buildCharts(enriched: EnrichedItem[]): void {
    const confirmacaoBase = enriched.filter(it => this.normalizeBase(it.proximaAcao).includes('CONFIRMACAO DE ENTREGA'));

    // Saldo por UF focado em confirmação
    const byUf: Record<string, { count: number; saldo: number }> = {};
    
    confirmacaoBase.forEach(it => {
      const uf = it.uf || 'N/D';
      byUf[uf] = byUf[uf] || { count: 0, saldo: 0 };
      byUf[uf].count += 1;
      byUf[uf].saldo += it.saldo;
    });
    // Ordenar categorias por quantidade de títulos (não por valor)
    this.ufCategories = Object.keys(byUf).sort((a, b) => byUf[b].count - byUf[a].count);
    // Série do gráfico mostra quantidade de títulos por UF
    this.ufSeries = this.ufCategories.length
      ? [{ name: 'Títulos', data: this.ufCategories.map(uf => byUf[uf].count) }]
      : [];

    // Card de "Maior backlog por UF": mantém cálculo baseado em saldo total
    const allUFs = Object.keys(byUf);
    if (allUFs.length) {
      const maxUFBySaldo = allUFs.reduce((maxUF, uf) => byUf[uf].saldo > byUf[maxUF].saldo ? uf : maxUF, allUFs[0]);
      this.ufComMaiorSaldo = {
        uf: maxUFBySaldo,
        saldo: byUf[maxUFBySaldo].saldo,
        percentual: this.saldoTotal ? (byUf[maxUFBySaldo].saldo / this.saldoTotal) * 100 : 0,
      };
    } else {
      this.ufComMaiorSaldo = undefined;
    }

    // Distribuição por status dentro da confirmação
    const statusMap: Record<string, number> = {};
    confirmacaoBase.forEach(it => {
      const status = this.normalizeStatus(it.statusGeral);
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    
    // Mapear status normalizados para labels legíveis
    const statusLabelMap: Record<string, string> = {
      'CRÍTICO': 'Crítico',
      'EM_ATRASO': 'Em atraso',
      'PENDENTE': 'Pendente',
      'REGULARIZADO': 'Regularizado/Monitoramento',
      'EM_DIA': 'Em dia'
    };
    
    // Usar labels legíveis como categorias
    this.statusCategories = Object.keys(statusMap).map(status => statusLabelMap[status] || status);
    this.statusSeries = this.statusCategories.length
      ? [{ name: 'Títulos', data: Object.keys(statusMap).map(st => statusMap[st]) }]
      : [];

    // Buckets de aging para visão geral (mantém carteira completa)
    const bucketDefs = this.getAgingBuckets();
    const agingBuckets: Array<{ label: string; quantidade: number; valorInicial: number; valorCorrigido: number }> = bucketDefs.map(b => ({ label: b.label, quantidade: 0, valorInicial: 0, valorCorrigido: 0 }));

    enriched.forEach(it => {
      const dias = it.diasEmAtraso || 0;
      const valorInicial = it.valor || 0;
      const valorCorrigido = it.saldo || 0;
      const idx = bucketDefs.findIndex(b => dias >= b.min && dias <= b.max);
      if (idx >= 0) {
        agingBuckets[idx].quantidade += 1;
        agingBuckets[idx].valorInicial += valorInicial;
        agingBuckets[idx].valorCorrigido += valorCorrigido;
      }
    });

    this.agingCategories = agingBuckets.map(b => b.label);
    this.agingSeries = [{ name: 'Quantidade', data: agingBuckets.map(b => b.quantidade) }];
    this.agingResumoItems = agingBuckets.map(b => ({ faixa: b.label, quantidade: b.quantidade, valorInicial: Number(b.valorInicial.toFixed(2)) }));

    // Prioridades dentro da confirmação
    const priorityMap: Record<string, number> = {};
    confirmacaoBase.forEach(it => {
      const prioridade = this.normalizePriority(it.prioridade);
      priorityMap[prioridade] = (priorityMap[prioridade] || 0) + 1;
    });
    const priorityKeys = Object.keys(priorityMap).sort((a, b) => this.priorityRank(b) - this.priorityRank(a));
    this.priorityDonutSeries = priorityKeys.map(key => ({ label: key, data: priorityMap[key] }));
    const totalPriority = priorityKeys.reduce((acc, key) => acc + (priorityMap[key] || 0), 0);
    this.priorityDonutLegend = priorityKeys.map(key => ({ label: key, count: priorityMap[key], pct: totalPriority ? (priorityMap[key] * 100) / totalPriority : 0 }));


  }

  private getAgingBuckets(): Array<{ label: string; min: number; max: number }> {
    return [
      { label: 'A vencer (0)', min: 0, max: 0 },
      { label: '1 a 7', min: 1, max: 7 },
      { label: '8 a 15', min: 8, max: 15 },
      { label: '16 a 30', min: 16, max: 30 },
      { label: '31 a 60', min: 31, max: 60 },
      { label: '61 a 90', min: 61, max: 90 },
      { label: '90+', min: 91, max: Number.MAX_SAFE_INTEGER },
    ];
  }

  private buildPriorities(enriched: EnrichedItem[]): void {
    const confirmacaoBase = enriched.filter(it => this.normalizeBase(it.proximaAcao).includes('CONFIRMACAO DE ENTREGA'));
    const base = confirmacaoBase.length ? confirmacaoBase : enriched;

    const sorted = [...base].sort((a, b) => b.score - a.score);
    this.priorityItems = sorted.slice(0, Math.min(30, sorted.length)).map(({ score, ...rest }) => rest);
    this.topPriorityCard = this.priorityItems[0] ?? null;

    const summary: Record<string, { quantidade: number; saldo: number }> = {};
    base.forEach(({ prioridade, saldo }) => {
      const key = this.normalizePriority(prioridade);
      if (!summary[key]) {
        summary[key] = { quantidade: 0, saldo: 0 };
      }
      summary[key].quantidade += 1;
      summary[key].saldo += saldo;
    });

    this.priorityOverview = Object.keys(summary)
      .map(key => ({ prioridade: key, quantidade: summary[key].quantidade, saldo: summary[key].saldo }))
      .sort((a, b) => this.priorityRank(b.prioridade) - this.priorityRank(a.prioridade));
  }

  private buildAgingList(enriched: EnrichedItem[]): void {
    const sorted = [...enriched].sort((a, b) => {
      const priorityDiff = this.priorityRank(b.prioridade) - this.priorityRank(a.prioridade);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const atrasoDiff = b.diasEmAtraso - a.diasEmAtraso;
      if (atrasoDiff !== 0) {
        return atrasoDiff;
      }
      return (b.saldo || 0) - (a.saldo || 0);
    });
    this.agingItems = sorted.map(({ score, ...rest }) => rest);
  }

  // Tratamento de ordenação disparada pelo PoTable
  onSort(event: any, table: 'aging' | 'priority'): void {
    if (!event || !event.column || !event.column.property) {
      return;
    }
    const asc = event.type === PoTableColumnSortType.Ascending;
    const prop = event.column.property as keyof DashboardViewItem;

    // Atualiza estado visual
    if (table === 'aging') {
      this.agingSortProp = prop;
      this.agingSortAsc = asc;
    } else {
      this.prioritySortProp = prop;
      this.prioritySortAsc = asc;
    }

    this.sortTable(table, prop, asc);
  }

  private applyCurrentSort(table: 'aging' | 'priority'): void {
    const prop = table === 'aging' ? this.agingSortProp : this.prioritySortProp;
    const asc = table === 'aging' ? this.agingSortAsc : this.prioritySortAsc;
    this.sortTable(table, prop, asc);
  }

  toggleSortDirection(table: 'aging' | 'priority'): void {
    if (table === 'aging') {
      this.agingSortAsc = !this.agingSortAsc;
    } else {
      this.prioritySortAsc = !this.prioritySortAsc;
    }
    this.applyCurrentSort(table);
  }

  private sortTable(table: 'aging' | 'priority', prop: keyof DashboardViewItem, asc: boolean): void {
    const sortFn = (a: DashboardViewItem, b: DashboardViewItem) => {
      const va = this.getComparableValue(a, String(prop));
      const vb = this.getComparableValue(b, String(prop));

      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR');
      }
      return asc ? cmp : -cmp;
    };

    if (table === 'aging') {
      this.agingItems = [...this.agingItems].sort(sortFn);
      this.updatePagination('aging');
    } else {
      this.priorityItems = [...this.priorityItems].sort(sortFn);
      this.updatePagination('priority');
    }
  }

  private updatePagination(table: 'aging' | 'priority'): void {
    if (table === 'aging') {
      this.agingPageIndex = Math.min(this.agingPageIndex, this.agingTotalPages);
      this.agingPaginatedItems = this.agingItems.slice(this.agingFromIndex, this.agingToIndex);
    } else {
      this.priorityPageIndex = Math.min(this.priorityPageIndex, this.priorityTotalPages);
      this.priorityPaginatedItems = this.priorityItems.slice(this.priorityFromIndex, this.priorityToIndex);
    }
  }

  onPageSizeChange(table: 'aging' | 'priority'): void {
    if (table === 'aging') {
      this.agingPageIndex = 1;
    } else {
      this.priorityPageIndex = 1;
    }
    this.updatePagination(table);
  }

  goNext(table: 'aging' | 'priority'): void {
    if (table === 'aging' && this.agingPageIndex < this.agingTotalPages) {
      this.agingPageIndex++;
      this.updatePagination('aging');
    }
    if (table === 'priority' && this.priorityPageIndex < this.priorityTotalPages) {
      this.priorityPageIndex++;
      this.updatePagination('priority');
    }
  }

  goPrev(table: 'aging' | 'priority'): void {
    if (table === 'aging' && this.agingPageIndex > 1) {
      this.agingPageIndex--;
      this.updatePagination('aging');
    }
    if (table === 'priority' && this.priorityPageIndex > 1) {
      this.priorityPageIndex--;
      this.updatePagination('priority');
    }
  }

  private getComparableValue(item: DashboardViewItem, property: string): string | number {
    switch (property) {
      case 'prioridade':
        return this.priorityRank(item.prioridade);
      case 'statusGeral':
        return this.normalizeStatus(item.statusGeral);
      case 'faixaAging':
        return this.normalizeFaixa((item as any).faixaAging);
      case 'diasDesdeEmissao':
      case 'diasParaVencimento':
      case 'diasEmAtraso':
      case 'valor':
      case 'saldo':
        return Number((item as any)[property]) || 0;
      default:
        return this.normalizeBase(String((item as any)[property] ?? ''));
    }
  }

  private normalizeBase(value?: string | null): string {
    const v = (value || '').toString();
    return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
  }

  private priorityRank(priority: string | undefined): number {
    const normalized = this.normalizePriority(priority);
    switch (normalized) {
      case 'CRÍTICA':
        return 4;
      case 'ALTA':
        return 3;
      case 'MÉDIA':
        return 2;
      case 'BAIXA':
        return 1;
      default:
        return 0;
    }
  }

  private higherPriority(p1: string | undefined, p2: string | undefined): string {
    const r1 = this.priorityRank(p1);
    const r2 = this.priorityRank(p2);
    return (r1 >= r2 ? this.normalizePriority(p1) : this.normalizePriority(p2)) || 'BAIXA';
  }

  private priorityFromScore(score: number): string {
    if (score >= 150) return 'CRÍTICA';
    if (score >= 100) return 'ALTA';
    if (score >= 50) return 'MÉDIA';
    return 'BAIXA';
  }

  formatNumber(value: number | undefined | null, decimals = 0): string {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number.isFinite(n) ? n : 0);
  }

  formatCurrency(value: number | undefined | null): string {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  }

  formatPercent(value: number | undefined | null, decimals = 1): string {
    const n = Number(value ?? 0);
    const txt = new Intl.NumberFormat('pt-BR', {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number.isFinite(n) ? n : 0);
    return `${txt}%`;
  }

  formatDays(days: number | undefined | null): string {
    const n = Number(days ?? 0);
    return `${this.formatNumber(Number.isFinite(n) ? n : 0)} dias`;
  }

  resolveTagType(value: string | undefined | null): PoTagType {
    const v = this.normalizePriority(value);
    switch (v) {
      case 'CRÍTICA':
        return PoTagType.Danger;
      case 'ALTA':
        return PoTagType.Warning;
      case 'MÉDIA':
        return PoTagType.Info;
      case 'BAIXA':
        return PoTagType.Success;
      default:
        return PoTagType.Info;
    }
  }

  resolveStatusTagType(value: string | undefined | null): PoTagType {
    const v = this.normalizeStatus(value);
    switch (v) {
      case 'CRÍTICO':
        return PoTagType.Danger;
      case 'EM_ATRASO':
        return PoTagType.Warning;
      case 'PENDENTE':
        return PoTagType.Info;
      case 'REGULARIZADO':
        return PoTagType.Success;
      case 'EM_DIA':
        return PoTagType.Success;
      default:
        return PoTagType.Info;
    }
  }

  private computeUltimaAtualizacao(): string | null {
    const datas = this.items
      .flatMap(item => (((item as any)['eventos'] as Array<{ dataOrdenacao?: string }>) || [])
        .map((evento: { dataOrdenacao?: string }) => evento?.dataOrdenacao || ''))
      .filter(Boolean)
      .map(valor => valor.padEnd(8, '0'));

    if (!datas.length) {
      return null;
    }

    const ultima = datas.reduce((max, atual) => (atual > max ? atual : max));
    const ano = ultima.substring(0, 4);
    const mes = ultima.substring(4, 6);
    const dia = ultima.substring(6, 8);
    return `${dia}/${mes}/${ano}`;
  }
}
