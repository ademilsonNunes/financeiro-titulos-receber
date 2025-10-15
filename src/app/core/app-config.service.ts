import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type AppConfig = Partial<{
  apiBasePath: string;
  oauthTokenEndpoint: string;
  productLine: string;
  absoluteBaseUrl: string; // ex.: http://10.0.132.4:8097 (fora do Protheus)
}>;

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private http = inject(HttpClient);
  private config: AppConfig = {};
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const cfg = await this.http.get<AppConfig>('assets/data/appConfig.json').toPromise();
      if (cfg && typeof cfg === 'object') this.config = cfg;
    } catch {
      // Sem appConfig.json tudo bem (usa environment)
    } finally {
      this.loaded = true;
    }
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] | undefined {
    return this.config[key];
  }
}
