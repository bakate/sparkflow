import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthAuthenticator } from './oauth-authenticator';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const accessToken = inject(OAuthAuthenticator).accessToken();

  if (accessToken === null) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  );
};
