import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PoChartModule,
  PoInfoModule,
  PoLoadingModule,
  PoPageModule,
  PoTableColumn,
  PoTableModule,
  PoTagModule,
  PoWidgetModule
} from '@po-ui/ng-components';
import { TimelineRecebimentoItem, TimelineRecebimentoService } from '../../core/timeline-recebimento.service';

type PoTagType = 'default' | 'danger' | 'info' | 'primary' | 'success' | 'warning';

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
    PoPageModule,
    PoInfoModule,
    PoLoadingModule,
    PoTagModule,
    PoTableModule,
    PoChartModule,
    PoWidgetModule,
  ],
  template: `
  <po-page-default p-title="Dashboard de Recebimento" p-size="auto" [attr.aria-busy]="loading">
    <po-loading *ngIf="loading"></po-loading>

    <ng-container *ngIf="!loading && items.length; else emptyState">
      <section class="summary-grid" role="region" aria-label="Indicadores gerais">
        <po-info p-label="Total de títulos" [p-value]="formatNumber(total)"></po-info>
        <po-info p-label="Valor faturado" [p-value]="formatCurrency(valorTotal)"></po-info>
        <po-info p-label="Saldo pendente" [p-value]="formatCurrency(saldoTotal)"></po-info>
        <po-info p-label="% baixados" [p-value]="formatPercent(percentualBaixados)"></po-info>
        <po-info p-label="Ticket médio" [p-value]="formatCurrency(ticketMedio)"></po-info>
        <po-info p-label="Maior atraso" [p-value]="formatDays(maiorAtraso)"></po-info>
        <po-info p-label="Lead time médio" [p-value]="formatNumber(leadTimeMedio, 1) + ' dias'"></po-info>
        <po-info p-label="Última atualização" [p-value]="ultimaAtualizacao || 'Sem registros'"></po-info>
      </section>

      <section class="insights-grid" role="region" aria-label="Insights rápidos">
        <po-widget p-title="Maior risco" *ngIf="topPriorityCard">
          <div class="insight">
            <div class="insight-title">{{ topPriorityCard?.nf }} • {{ topPriorityCard?.cliente }}</div>
            <div class="insight-subtitle">Saldo {{ formatCurrency(topPriorityCard?.saldo || 0) }}</div>
            <po-tag [p-type]="resolveTagType(topPriorityCard?.prioridade)" [p-value]="topPriorityCard?.prioridade"></po-tag>
            <small>{{ topPriorityCard?.proximaAcao }}</small>
          </div>
        </po-widget>

        <po-widget p-title="Maior saldo por UF" *ngIf="ufComMaiorSaldo">
          <div class="insight">
            <div class="insight-title">{{ ufComMaiorSaldo?.uf }}</div>
            <div class="insight-subtitle">Saldo {{ formatCurrency(ufComMaiorSaldo?.saldo || 0) }}</div>
            <small>Equivale a {{ formatPercent(ufComMaiorSaldo?.percentual || 0) }} do saldo total</small>
          </div>
        </po-widget>

        <po-widget p-title="Distribuição de prioridades">
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
          <header>Saldo pendente por UF</header>
          <po-chart [p-type]="chartTypeColumn" [p-series]="ufSeries" [p-categories]="ufCategories" [p-height]="260"></po-chart>
        </div>
        <div class="chart-card">
          <header>Distribuição por status</header>
          <po-chart [p-type]="chartTypeBar" [p-series]="statusSeries" [p-categories]="statusCategories" [p-height]="260"></po-chart>
        </div>
        <div class="chart-card">
          <header>Faixas de aging</header>
          <po-chart [p-type]="chartTypeColumn" [p-series]="agingSeries" [p-categories]="agingCategories" [p-height]="260"></po-chart>
        </div>
        <div class="chart-card">
          <header>Prioridade das ações</header>
          <po-chart [p-type]="chartTypeDonut" [p-series]="priorityDonutSeries" [p-height]="260"></po-chart>
        </div>
      </section>

      <section class="aging-board" role="region" aria-label="Aging detalhado">
        <div class="section-header">
          <h3>Aging detalhado</h3>
          <span>{{ formatNumber(agingItems.length) }} títulos monitorados</span>
        </div>
        <po-table [p-columns]="agingColumns" [p-items]="agingItems"></po-table>
      </section>

      <section class="prioridades" role="region" aria-label="Fila de priorização">
        <div class="section-header">
          <h3>Fila de priorização</h3>
          <span>Top {{ formatNumber(priorityItems.length) }} títulos</span>
        </div>
        <po-table [p-columns]="priorityColumns" [p-items]="priorityItems"></po-table>
      </section>
    </ng-container>

    <ng-template #emptyState>
      <div class="empty-state" role="status" aria-live="polite">
        <po-info p-label="Nenhum dado" p-value="Verifique o token e tente novamente."></po-info>
      </div>
    </ng-template>
  </po-page-default>
  `,
  styleUrls: ['./timeline-recebimento.component.scss']
})
export class TimelineRecebimentoComponent implements OnInit {
  private service = inject(TimelineRecebimentoService);

  loading = false;
  items: TimelineRecebimentoItem[] = [];

  chartTypeBar = 'bar';
  chartTypeColumn = 'column';
  chartTypeDonut = 'donut';

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

  ufCategories: string[] = [];
  ufSeries: Array<{ name: string; data: number[] }> = [];

  statusCategories: string[] = [];
  statusSeries: Array<{ name: string; data: number[] }> = [];

  agingCategories: string[] = [];
  agingSeries: Array<{ name: string; data: number[] }> = [];

  priorityDonutSeries: Array<{ name: string; data: number }> = [];

  priorityOverview: PriorityOverviewItem[] = [];
  ufComMaiorSaldo?: UfSaldoResumo;
  topPriorityCard: DashboardViewItem | null = null;

  prioritySubtitles = [
    { value: 'CRÍTICA', color: 'color-07', label: 'Crítica' },
    { value: 'ALTA', color: 'color-08', label: 'Alta' },
    { value: 'MÉDIA', color: 'color-02', label: 'Média' },
    { value: 'BAIXA', color: 'color-10', label: 'Baixa' },
  ];

  statusSubtitles = [
    { value: 'EM_DIA', color: 'color-10', label: 'Em dia' },
    { value: 'EM_ATRASO', color: 'color-08', label: 'Em atraso' },
    { value: 'CRÍTICO', color: 'color-07', label: 'Crítico' },
    { value: 'PENDENTE', color: 'color-03', label: 'Pendente' },
    { value: 'REGULARIZADO', color: 'color-11', label: 'Regularizado' },
  ];

  faixaSubtitles = [
    { value: 'A_VENCER', color: 'color-10', label: 'A vencer' },
    { value: 'EM_DIA', color: 'color-11', label: 'Em dia' },
    { value: 'EM_ATRASO', color: 'color-08', label: 'Em atraso' },
    { value: 'VENCIDO', color: 'color-07', label: 'Vencido' },
    { value: 'SEM_CLASSIFICACAO', color: 'color-03', label: 'Não classificado' },
  ];

  priorityColumns: PoTableColumn[] = this.createPriorityColumns();
  agingColumns: PoTableColumn[] = this.createAgingColumns();

  priorityItems: DashboardViewItem[] = [];
  agingItems: DashboardViewItem[] = [];

  ngOnInit(): void {
    this.fetchData();
  }

  formatCurrency(value?: number): string {
    const amount = Number.isFinite(value as number) ? (value as number) : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  formatNumber(value?: number, fractionDigits = 0): string {
    const numeric = Number.isFinite(value as number) ? (value as number) : 0;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(numeric);
  }

  formatPercent(value?: number): string {
    return `${this.formatNumber(value, 1)}%`;
  }

  formatDays(value?: number): string {
    const numeric = Math.round(Number.isFinite(value as number) ? (value as number) : 0);
    return `${numeric} dia${Math.abs(numeric) === 1 ? '' : 's'}`;
  }

  resolveTagType(priority?: string | null): PoTagType {
    const normalized = this.normalizePriority(priority);
    switch (normalized) {
      case 'CRÍTICA':
        return 'danger';
      case 'ALTA':
        return 'warning';
      case 'MÉDIA':
        return 'info';
      case 'BAIXA':
        return 'success';
      default:
        return 'default';
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
    const enriched = this.items.map(item => this.enrichItem(item));
    this.buildCharts(enriched);
    this.buildPriorities(enriched);
    this.buildAgingList(enriched);
  }

  private buildCharts(enriched: EnrichedItem[]): void {
    const byUf: Record<string, { saldo: number }> = {};
    enriched.forEach(it => {
      const uf = it.uf || 'N/D';
      byUf[uf] = byUf[uf] || { saldo: 0 };
      byUf[uf].saldo += it.saldo;
    });
    this.ufCategories = Object.keys(byUf).sort((a, b) => byUf[b].saldo - byUf[a].saldo);
    this.ufSeries = this.ufCategories.length
      ? [{ name: 'Saldo pendente', data: this.ufCategories.map(uf => Number(byUf[uf].saldo.toFixed(2))) }]
      : [];

    this.ufComMaiorSaldo = this.ufCategories.length
      ? {
          uf: this.ufCategories[0],
          saldo: byUf[this.ufCategories[0]].saldo,
          percentual: this.saldoTotal ? (byUf[this.ufCategories[0]].saldo / this.saldoTotal) * 100 : 0,
        }
      : undefined;

    const statusMap: Record<string, number> = {};
    enriched.forEach(it => {
      const status = this.normalizeStatus(it.statusGeral);
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    this.statusCategories = Object.keys(statusMap);
    this.statusSeries = this.statusCategories.length
      ? [{ name: 'Títulos', data: this.statusCategories.map(st => statusMap[st]) }]
      : [];

    const agingMap: Record<string, number> = {};
    enriched.forEach(it => {
      const faixa = this.normalizeFaixa(it.faixaAging);
      agingMap[faixa] = (agingMap[faixa] || 0) + 1;
    });
    this.agingCategories = Object.keys(agingMap);
    this.agingSeries = this.agingCategories.length
      ? [{ name: 'Quantidade', data: this.agingCategories.map(fx => agingMap[fx]) }]
      : [];

    const priorityMap: Record<string, number> = {};
    enriched.forEach(it => {
      const prioridade = this.normalizePriority(it.prioridade);
      priorityMap[prioridade] = (priorityMap[prioridade] || 0) + 1;
    });
    const priorityKeys = Object.keys(priorityMap).sort((a, b) => this.priorityRank(b) - this.priorityRank(a));
    this.priorityDonutSeries = priorityKeys.map(key => ({ name: key, data: priorityMap[key] }));
  }

  private buildPriorities(enriched: EnrichedItem[]): void {
    const sorted = [...enriched].sort((a, b) => b.score - a.score);
    this.priorityItems = sorted.slice(0, Math.min(30, sorted.length)).map(({ score, ...rest }) => rest);
    this.topPriorityCard = this.priorityItems[0] ?? null;

    const summary: Record<string, { quantidade: number; saldo: number }> = {};
    enriched.forEach(({ prioridade, saldo }) => {
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

  private createPriorityColumns(): PoTableColumn[] {
    return [
      { property: 'nf', label: 'NF', width: '80px' },
      { property: 'parcela', label: 'Parcela', width: '80px' },
      { property: 'cliente', label: 'Cliente' },
      { property: 'uf', label: 'UF', width: '60px' },
      { property: 'prioridade', label: 'Prioridade', type: 'subtitle', subtitles: this.prioritySubtitles, width: '120px' },
      { property: 'statusGeral', label: 'Status', type: 'subtitle', subtitles: this.statusSubtitles, width: '120px' },
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
      { property: 'statusGeral', label: 'Status geral', type: 'subtitle', subtitles: this.statusSubtitles, width: '140px' },
      { property: 'prioridade', label: 'Prioridade', type: 'subtitle', subtitles: this.prioritySubtitles, width: '120px' },
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
    const prioridade = this.normalizePriority(item.proximaAcao?.prioridade || this.inferPriority(aging));
    const statusGeral = this.normalizeStatus(aging['statusGeral'] || item.statusCanhotaRecebido || item.statusCanhotaRetorno || 'PENDENTE');
    const faixaAging = this.normalizeFaixa(aging['faixaAging']);
    const diasEmAtraso = this.getDiasEmAtraso(aging);
    const diasParaVencimento = Number(aging['diasParaVencimento'] ?? 0);
    const diasDesdeEmissao = Number(aging['diasDesdeEmissao'] ?? 0);
    const saldo = Number(item.saldo ?? 0);
    const valor = Number(item.valor ?? saldo);
    const proximaAcao = item.proximaAcao?.descricao || '';

    let score = saldo;
    if (diasEmAtraso > 0) {
      score += diasEmAtraso * 1000;
    } else if (diasParaVencimento < 0) {
      score += Math.abs(diasParaVencimento) * 100;
    }
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

  private inferPriority(aging: Record<string, any>): string {
    const diasAtraso = this.getDiasEmAtraso(aging);
    if (diasAtraso >= 30) {
      return 'CRÍTICA';
    }
    if (diasAtraso >= 10) {
      return 'ALTA';
    }
    if (diasAtraso > 0) {
      return 'MÉDIA';
    }
    const diasParaVencer = Number(aging['diasParaVencimento'] ?? 0);
    if (diasParaVencer <= 5) {
      return 'ALTA';
    }
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

  private normalizeBase(value?: string | null): string {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
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

  private computeUltimaAtualizacao(): string | null {
    const datas = this.items
      .flatMap(item => (item.eventos || []).map(evento => evento?.dataOrdenacao || ''))
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
