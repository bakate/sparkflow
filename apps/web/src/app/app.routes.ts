import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'challenges',
    loadComponent: () =>
      import('./features/challenges/ui/challenges-page').then((module) => module.ChallengesPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'challenges',
  },
];
