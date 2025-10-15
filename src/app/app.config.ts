import { APP_INITIALIZER } from '@angular/core';
import { AppConfigService } from './core/app-config.service';

function initAppConfig(cfg: AppConfigService) { return () => cfg.load(); }import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

import { ApplicationConfig, importProvidersFrom, isDevMode } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PoHttpRequestModule } from '@po-ui/ng-components';
import { ProtheusLibCoreModule } from '@totvs/protheus-lib-core';
import { authInterceptor } from './core/auth.interceptor';
import { loggingInterceptor } from './core/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_INITIALIZER, useFactory: initAppConfig, deps: [AppConfigService], multi: true },
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(
      withInterceptors([authInterceptor, ...(isDevMode() ? [loggingInterceptor] : [])])
    ),
    importProvidersFrom([
      BrowserAnimationsModule,
      PoHttpRequestModule,
      ProtheusLibCoreModule,
    ]),
  ],
};

