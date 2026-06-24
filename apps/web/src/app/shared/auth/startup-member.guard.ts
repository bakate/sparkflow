import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthSession } from './auth-session';

export const startupMemberGuard: CanActivateFn = () => {
  const actor = inject(AuthSession).currentActor();

  if (actor?.role === 'startup-member') {
    return true;
  }

  return inject(Router).createUrlTree(['/challenges']);
};
