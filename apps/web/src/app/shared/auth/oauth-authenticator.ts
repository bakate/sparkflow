import { inject, Injectable } from '@angular/core';
import { AuthConfig, OAuthService } from 'angular-oauth2-oidc';
import { environment } from '@env/environment';
import { AuthSession } from './auth-session';

@Injectable({ providedIn: 'root' })
export class OAuthAuthenticator {
  private readonly authSession = inject(AuthSession);
  private readonly oauthService = inject(OAuthService);

  async initialize(): Promise<void> {
    this.oauthService.configure(authConfig);
    this.oauthService.setupAutomaticSilentRefresh();

    await this.oauthService.loadDiscoveryDocumentAndTryLogin();
    this.refreshSession();

    if (!this.oauthService.hasValidAccessToken()) {
      this.oauthService.initCodeFlow();
      return;
    }

    cleanOAuthCallbackUrl();
  }

  accessToken(): string | null {
    if (!this.oauthService.hasValidAccessToken()) {
      this.authSession.clear();
      return null;
    }

    const accessToken = this.oauthService.getAccessToken();
    this.authSession.replaceAccessToken({ accessToken });

    return accessToken;
  }

  logout(): void {
    this.authSession.clear();
    this.oauthService.logOut();
  }

  private refreshSession(): void {
    this.authSession.replaceAccessToken({
      accessToken: this.oauthService.hasValidAccessToken()
        ? this.oauthService.getAccessToken()
        : null,
    });
  }
}

const authConfig: AuthConfig = {
  issuer: environment.auth.issuer,
  redirectUri: window.location.origin,
  clientId: environment.auth.clientId,
  responseType: 'code',
  scope: 'openid profile email',
  requireHttps: false,
  showDebugInformation: false,
};

const oauthCallbackSearchParams = [
  'code',
  'error',
  'error_description',
  'iss',
  'session_state',
  'state',
] as const;

const cleanOAuthCallbackUrl = (): void => {
  const url = new URL(window.location.href);
  const hasOAuthCallbackSearchParam = oauthCallbackSearchParams.some((searchParam) =>
    url.searchParams.has(searchParam),
  );

  if (!hasOAuthCallbackSearchParam) {
    return;
  }

  for (const searchParam of oauthCallbackSearchParams) {
    url.searchParams.delete(searchParam);
  }

  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);
};
