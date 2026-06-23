import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthSession } from './auth-session';

export const companyAdminGuard: CanActivateFn = () => {
  const actor = inject(AuthSession).currentActor();

  if (actor?.role === 'company-admin') {
    return true;
  }

  return inject(Router).createUrlTree(['/challenges']);
};
