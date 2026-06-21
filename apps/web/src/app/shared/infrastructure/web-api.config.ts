import { InjectionToken } from '@angular/core';

export type WebApiConfig = {
  readonly apiUrl: string;
};

export const WEB_API_CONFIG = new InjectionToken<WebApiConfig>('WEB_API_CONFIG');
