import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { AuthSession } from '@shared/auth/auth-session';
import { OAuthAuthenticator } from '@shared/auth/oauth-authenticator';

@Component({
  selector: 'navbar',
  imports: [Button, NgOptimizedImage, RouterLink, Tag],
  template: `
    <header class="p-3 mb-4 navbar-shadow border-bottom-1">
      <div class="flex flex-column md:flex-row md:align-items-center justify-content-between gap-3">
        <a routerLink="/" class="flex gap-2 align-items-center navbar-logo">
          <img ngSrc="/logo.png" alt="sparkflow logo" width="40" height="40" />
          <span class="mr-1 uppercase text-primary">Sparkflow</span>
        </a>

        @if (currentUser(); as user) {
          <div
            class="flex flex-column sm:flex-row sm:align-items-center gap-2 md:justify-content-end"
          >
            <p-tag [value]="roleLabel()" severity="info" />
            <p-button
              icon="pi pi-sign-out"
              label="Logout"
              severity="secondary"
              (onClick)="logout()"
            />
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    .navbar-logo {
      text-decoration: none;
      color: inherit;
      font-size: 1.5rem;
      font-weight: 600;
    }
  `,
})
export class Navbar {
  private readonly authSession = inject(AuthSession);
  private readonly authenticator = inject(OAuthAuthenticator);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.currentUser();

    return user === null ? '' : user.role.replaceAll('-', ' ');
  });

  protected logout(): void {
    this.authenticator.logout();
  }
}
