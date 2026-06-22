import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideOAuthClient } from 'angular-oauth2-oidc';

import { routes } from './app.routes';
import { sparkFlowPrimeNgConfig } from './shell/ui/primeng.config';
import { WEB_API_CONFIG } from '@shared/infrastructure/web-api.config';
import { environment } from '@env/environment';
import { MessageService } from 'primeng/api';
import { OAuthAuthenticator } from '@shared/auth/oauth-authenticator';
import { authInterceptor } from '@shared/auth/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideOAuthClient(),
    provideAppInitializer(() => inject(OAuthAuthenticator).initialize()),
    providePrimeNG(sparkFlowPrimeNgConfig),
    provideRouter(routes),
    {
      provide: WEB_API_CONFIG,
      useValue: { apiUrl: environment.apiUrl },
    },
    MessageService,
  ],
};
