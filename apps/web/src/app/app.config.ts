import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { sparkFlowPrimeNgConfig } from './shell/ui/primeng.config';
import { WEB_API_CONFIG } from '@shared/infrastructure/web-api.config';
import { environment } from '@env/environment';
import { MessageService } from 'primeng/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    providePrimeNG(sparkFlowPrimeNgConfig),
    provideRouter(routes),
    {
      provide: WEB_API_CONFIG,
      useValue: { apiUrl: environment.apiUrl },
    },
    MessageService,
  ],
};
