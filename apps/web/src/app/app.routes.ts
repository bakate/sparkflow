import { Routes } from '@angular/router';
import { companyAdminGuard } from '@shared/auth/company-admin.guard';
import { startupMemberGuard } from '@shared/auth/startup-member.guard';

export const routes: Routes = [
  {
    path: 'opportunities',
    canActivate: [startupMemberGuard],
    loadComponent: () =>
      import('./features/challenges/ui/startup-opportunities-page/startup-opportunities-page').then(
        (module) => module.StartupOpportunitiesPage,
      ),
  },
  {
    path: 'challenges/:challengeId/proposals',
    canActivate: [companyAdminGuard],
    loadComponent: () =>
      import('./features/challenges/ui/challenge-proposals-page/challenge-proposals-page').then(
        (module) => module.ChallengeProposalsPage,
      ),
  },
  {
    path: 'challenges',
    loadComponent: () =>
      import('./features/challenges/ui/challenges-page/challenges-page').then(
        (module) => module.ChallengesPage,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'challenges',
  },
];
