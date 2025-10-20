import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PoPageDefault, PoPageModule, PoInfoModule, PoLoadingModule, PoTagModule, PoTableModule, PoTableColumn, PoChartModule } from '@po-ui/ng-components';
import { TimelineRecebimentoService, TimelineRecebimentoItem } from '../../core/timeline-recebimento.service';

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
  ],
  template: `
  <po-page-default p-title="Dashboard de Recebimento" [attr.aria-busy]="loading">
    <div class="summary" role="region" aria-label="Resumo">
      <po-info p-label="Total de títulos" [p-value]="total.toString()"></po-info>
      <po-info p-label="Pendentes" [p-value]="pendentes.toString()"></po-info>
      <po-info p-label="Atrasados" [p-value]="atrasados.toString()"></po-info>
      <po-info p-label="Baixados" [p-value]="baixados.toString()"></po-info>
    </div>

    <po-loading *ngIf="loading"></po-loading>

    <div class="charts" *ngIf="!loading && items.length" role="region" aria-label="Gráficos">
      <div class="chart">
        <po-chart [p-type]="chartTypeBar" [p-series]="ufSeries" [p-categories]="ufCategories" [p-height]="280"></po-chart>
      </div>
      <div class="chart">
        <po-chart [p-type]="chartTypeDonut" [p-series]="vendedorSeries" [p-height]="280"></po-chart>
      </div>
    </div>

    <div class="prioridades" *ngIf="!loading && items.length" role="region" aria-label="Prioridades">
      <h3>Prioridades</h3>
      <po-table [p-columns]="priorityColumns" [p-items]="priorityItems"></po-table>
    </div>

    <div class="empty-state" *ngIf="!loading && !items.length" role="status" aria-live="polite">
      <po-info p-label="Nenhum dado" p-value="Verifique o token e tente novamente."></po-info>
    </div>
  </po-page-default>
  `,
  styles: [
    `.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }`,
    `.charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 16px 0; }`,
    `.prioridades { margin-top: 24px; }`
  ]
})
export class TimelineRecebimentoComponent implements OnInit {
  private service = inject(TimelineRecebimentoService);
  loading = false;
  items: TimelineRecebimentoItem[] = [];

  chartTypeBar: any = 'column';
  chartTypeDonut: any = 'donut';

  total = 0;
  pendentes = 0;
  atrasados = 0;
  baixados = 0;

  ufCategories: string[] = [];
  ufSeries: Array<{ name: string; data: number[] }> = [];

  vendedorSeries: Array<{ name: string; data: number } | any> = [];

  priorityColumns: PoTableColumn[] = [
    { property: 'nf', label: 'NF' },
    { property: 'parcela', label: 'Parcela' },
    { property: 'nomeCliente', label: 'Cliente' },
    { property: 'uf', label: 'UF' },
    { property: 'valor', label: 'Valor', type: 'currency', format: 'BRL' },
    { property: 'saldo', label: 'Saldo', type: 'currency', format: 'BRL' },
    { property: 'status', label: 'Status' },
    { property: 'diasAtraso', label: 'Dias atraso' },
  ];
  priorityItems: Array<any> = [];

  ngOnInit(): void {
    this.fetchData();
  }

  private fetchData(): void {
    this.loading = true;
    this.service.list().subscribe({
      next: (arr) => {
        this.items = Array.isArray(arr) ? arr : [];
        this.computeSummary();
        this.buildCharts();
        this.buildPriorities();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private computeSummary(): void {
    this.total = this.items.length;
    const isBaixado = (it: TimelineRecebimentoItem) => String(it.statusCanhotaRecebido || '').toLowerCase().includes('baix');
    const isRetorno = (it: TimelineRecebimentoItem) => String(it.statusCanhotaRetorno || '').toLowerCase().includes('ret');
    this.baixados = this.items.filter(isBaixado).length;
    const pend = this.items.filter(it => !isBaixado(it));
    this.pendentes = pend.length;
    // Heurística: atraso conforme aging.diasDesdeVencimento > 0 ou saldo > 0 e não baixado
    this.atrasados = pend.filter(it => {
      const aging = (it.aging || {}) as any;
      const dv = Number(aging['diasDesdeVencimento'] ?? aging['diasAtraso'] ?? 0);
      return dv > 0;
    }).length;
  }

  private buildCharts(): void {
    // Distribuição por UF
    const byUf: Record<string, number> = {};
    this.items.forEach(it => {
      const uf = String(it.uf || '').trim() || 'N/D';
      byUf[uf] = (byUf[uf] || 0) + 1;
    });
    this.ufCategories = Object.keys(byUf);
    this.ufSeries = [{ name: 'Títulos', data: this.ufCategories.map(uf => byUf[uf]) }];

    // Distribuição por Vendedor (pie)
    const byVend: Record<string, number> = {};
    this.items.forEach(it => {
      const v = String(it.vendedor || '').trim() || 'N/D';
      byVend[v] = (byVend[v] || 0) + 1;
    });
    this.vendedorSeries = Object.keys(byVend).map(v => ({ name: v, data: byVend[v] }));
  }

  private buildPriorities(): void {
    const score = (it: TimelineRecebimentoItem): number => {
      const aging = (it.aging || {}) as any;
      const dv = Number(aging['diasDesdeVencimento'] ?? aging['diasAtraso'] ?? 0);
      const saldo = Number(it.saldo ?? 0);
      const isBaixado = String(it.statusCanhotaRecebido || '').toLowerCase().includes('baix');
      return isBaixado ? -Infinity : (dv * 1000 + saldo);
    };
    const sorted = [...this.items].sort((a,b) => score(b) - score(a));
    this.priorityItems = sorted.slice(0, 15).map(it => ({
      nf: it.nf,
      parcela: it.parcela,
      nomeCliente: it.nomeCliente,
      uf: it.uf,
      valor: it.valor,
      saldo: it.saldo,
      status: it.statusCanhotaRecebido || it.statusCanhotaRetorno || '',
      diasAtraso: Number(((it.aging || {}) as any)['diasDesdeVencimento'] ?? ((it.aging || {}) as any)['diasAtraso'] ?? 0),
    }));
  }
}