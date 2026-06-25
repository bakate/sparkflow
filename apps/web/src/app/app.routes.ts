import { Routes } from '@angular/router';
import { companyAdminGuard } from '@shared/auth/company-admin.guard';
import { startupMemberGuard } from '@shared/auth/startup-member.guard';
import { ChallengesStore } from './features/challenges/application/challenges-store';
import { CHALLENGE_GATEWAY } from './features/challenges/application/challenge-gateway';
import { HttpChallengeGateway } from './features/challenges/infrastructure/http-challenge-gateway';

export const routes: Routes = [
  {
    path: 'opportunities',
    canActivate: [startupMemberGuard],
    providers: [ChallengesStore, { provide: CHALLENGE_GATEWAY, useClass: HttpChallengeGateway }],
    loadComponent: () =>
      import('./features/challenges/ui/startup-opportunities-page/startup-opportunities-page').then(
        (module) => module.StartupOpportunitiesPage,
      ),
  },
  {
    path: 'challenges/:challengeId/proposals',
    canActivate: [companyAdminGuard],
    providers: [
      ChallengesStore,
      {
        provide: CHALLENGE_GATEWAY,
        useClass: HttpChallengeGateway,
      },
    ],
    loadComponent: () =>
      import('./features/challenges/ui/challenge-proposals-page/challenge-proposals-page').then(
        (module) => module.ChallengeProposalsPage,
      ),
  },
  {
    path: 'challenges',
    providers: [
      ChallengesStore,
      {
        provide: CHALLENGE_GATEWAY,
        useClass: HttpChallengeGateway,
      },
    ],
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
