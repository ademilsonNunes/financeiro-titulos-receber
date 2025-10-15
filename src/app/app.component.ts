import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

import {
  PoMenuItem,
  PoMenuModule,
  PoPageModule,
  PoToolbarAction,
  PoToolbarModule,
  PoModalModule,
  PoModalComponent,
  PoNotificationModule,
  PoNotificationService,
  PoFieldModule,
  PoButtonModule,
  PoTagModule,
} from '@po-ui/ng-components';
import { AppConfigService } from './core/app-config.service';
import { ProAppConfigService } from '@totvs/protheus-lib-core';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    FormsModule,
    PoToolbarModule,
    PoPageModule,
    PoMenuModule,
    PoModalModule,
    PoNotificationModule,
    PoFieldModule,
    PoButtonModule,
    HttpClientModule,
    PoTagModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css', './app.component.scss'],
})
export class AppComponent implements OnInit {
  private proAppConfigService = inject(ProAppConfigService);
  private poNotification = inject(PoNotificationService);
  private authService = inject(AuthService);
  private appCfg = inject(AppConfigService);

  @ViewChild('tokenModal', { static: false }) tokenModal?: PoModalComponent;

  showSidebar = true; // inicia expandida
  tokenInput = '';
  username = '';
  password = '';
  loadingToken = false;
  envLabel = '';

  readonly menus: PoMenuItem[] = [
    { label: 'Consulta de Canhotos', link: '/titulos', icon: 'po-icon-news' },
    { label: 'Ajuda (Help)', action: () => this.poNotification.information('Abrir documentação'), icon: 'po-icon-help' },
    { label: 'Sair', action: () => this.fechar(), icon: 'po-icon-exit' },
  ];

  readonly toolbarActions: PoToolbarAction[] = [
    { label: this.showSidebar ? 'Recolher menu' : 'Expandir menu', action: () => this.toggleSidebar() },
    { label: 'Token: ausente', action: () => this.openTokenModal() },
    { label: 'Definir Token', action: () => this.openTokenModal() },
    { label: 'Sair', action: () => this.fechar() },
  ];

  ngOnInit(): void {
    // Mostra o badge de ambiente
    const host = (typeof window !== 'undefined') ? window.location.hostname : '';
    const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(host);
    const abs = (this.appCfg.get('absoluteBaseUrl') as string | undefined) || '';
    this.envLabel = abs && !isLocal ? 'Produção (absolute)' : (isLocal ? 'Dev (proxy)' : 'Protheus (embed)');

    // Prefill dev credentials when available
    this.username = (environment as any).devUsername || '';
    this.password = (environment as any).devPassword || '';

    const existing = this.authService.getToken();
    this.updateTokenStatus(existing);

    // If no token and dev credentials are set, try to fetch a token automatically
    if (!existing && this.username && this.password) {
      this.authService.requestToken(this.username, this.password).subscribe({
        next: (resp) => {
          if (resp?.access_token) {
            this.authService.setToken(resp.access_token);
            this.updateTokenStatus(resp.access_token);
          }
        },
        error: () => {
          // Silent failure; user can open modal and try again
        },
      });
    }

    // Atualiza status quando o token mudar via modal
    (this.authService as any).token$?.subscribe((t: string | null) => this.updateTokenStatus(t));
  }

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
    this.toolbarActions[0].label = this.showSidebar ? 'Recolher menu' : 'Expandir menu';
  }

  openTokenModal(): void {
    this.tokenInput = this.authService.getToken() || '';
    this.tokenModal?.open();
  }

  saveToken(): void {
    const trimmed = (this.tokenInput || '').trim();
    if (!trimmed) {
      this.poNotification.warning('Informe um token válido');
      return;
    }
    this.authService.setToken(trimmed);
    this.poNotification.success('Token salvo em memória. As próximas requisições usarão este Bearer.');
    this.updateTokenStatus(trimmed);
    this.tokenModal?.close();
  }

  generateToken(): void {
    const u = (this.username || '').trim();
    const p = (this.password || '').trim();
    if (!u || !p) {
      this.poNotification.warning('Informe Usuário e senha para gerar o token');
      return;
    }
    this.loadingToken = true;
    this.authService.requestToken(u, p).subscribe({
      next: (resp) => {
        if (resp?.access_token) {
          this.authService.setToken(resp.access_token);
          this.poNotification.success('Token gerado e salvo em memória.');
          this.tokenInput = resp.access_token;
          this.updateTokenStatus(resp.access_token);
        } else {
          this.poNotification.error('Resposta sem access_token');
        }
        this.loadingToken = false;
      },
      error: (err) => {
        this.loadingToken = false;
        this.poNotification.error('Falha ao gerar token');
        console.error(err);
      },
    });
  }

  fechar(): void {
    this.proAppConfigService.callAppClose(true);
  }

  private updateTokenStatus(token: string | null): void {
    const has = !!(token && token.length > 0);
    this.toolbarActions[1].label = has ? 'Token: OK' : 'Token: ausente';
  }
}
