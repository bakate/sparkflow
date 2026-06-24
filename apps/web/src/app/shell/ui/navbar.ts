import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Button } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { Tag } from 'primeng/tag';
import { AuthSession } from '@shared/auth/auth-session';
import { OAuthAuthenticator } from '@shared/auth/oauth-authenticator';
import { NOTIFICATION_GATEWAY } from '@features/notifications/application/notification-gateway';
import { NotificationsStore } from '@features/notifications/application/notifications-store';
import { HttpNotificationGateway } from '@features/notifications/infrastructure/http-notification-gateway';

@Component({
  selector: 'navbar',
  imports: [Button, NgOptimizedImage, OverlayBadgeModule, RouterLink, RouterLinkActive, Tag],
  providers: [
    NotificationsStore,
    {
      provide: NOTIFICATION_GATEWAY,
      useClass: HttpNotificationGateway,
    },
  ],
  template: `
    <header class="p-3 mb-4 navbar-shadow border-bottom-1">
      <div class="flex flex-column md:flex-row md:align-items-center justify-content-between gap-3">
        <div class="flex flex-column sm:flex-row sm:align-items-center gap-3">
          <a routerLink="/" class="flex gap-2 align-items-center navbar-logo">
            <img ngSrc="/logo.png" alt="sparkflow logo" width="40" height="40" />
            <span class="mr-1 uppercase text-primary">Sparkflow</span>
          </a>

          @if (currentUser(); as user) {
            <nav class="flex align-items-center gap-2" aria-label="Primary navigation">
              @if (user.role === 'startup-member') {
                <a
                  routerLink="/challenges"
                  routerLinkActive="navbar-link-active"
                  class="navbar-link"
                >
                  Marketplace
                </a>
                <a
                  routerLink="/opportunities"
                  routerLinkActive="navbar-link-active"
                  class="navbar-link"
                >
                  My opportunities
                </a>
              } @else if (user.role === 'company-admin') {
                <a
                  routerLink="/challenges"
                  routerLinkActive="navbar-link-active"
                  class="navbar-link"
                >
                  Challenges
                </a>
              }
            </nav>
          }
        </div>

        @if (currentUser(); as user) {
          <div
            class="flex flex-column sm:flex-row sm:align-items-center gap-2 md:justify-content-end"
          >
            <div class="relative">
              @if (notificationsStore.notificationCount() > 0) {
                <p-overlaybadge
                  [value]="notificationsStore.notificationCount()"
                  severity="danger"
                  [style]="{ 'font-variant-numeric': 'tabular-nums' }"
                >
                  <p-button
                    icon="pi pi-bell"
                    [rounded]="true"
                    [text]="true"
                    severity="secondary"
                    [loading]="notificationsStore.loading()"
                    [attr.aria-expanded]="notificationsPanelOpen()"
                    ariaLabel="Notifications"
                    (onClick)="toggleNotificationsPanel()"
                  />
                </p-overlaybadge>
              } @else {
                <p-button
                  icon="pi pi-bell"
                  severity="secondary"
                  [rounded]="true"
                  [loading]="notificationsStore.loading()"
                  [attr.aria-expanded]="notificationsPanelOpen()"
                  ariaLabel="Notifications"
                  (onClick)="toggleNotificationsPanel()"
                />
              }

              @if (notificationsPanelOpen()) {
                <section
                  class="notifications-panel absolute right-0 mt-2 z-5 surface-card border-1 surface-border border-round shadow-2"
                  aria-label="Notifications"
                >
                  <div
                    class="flex align-items-center justify-content-between gap-3 p-3 border-bottom-1 surface-border"
                  >
                    <p class="m-0 font-bold text-color">Notifications</p>
                    <p-button
                      icon="pi pi-refresh"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [loading]="notificationsStore.loading()"
                      ariaLabel="Refresh notifications"
                      (onClick)="reloadNotifications()"
                    />
                  </div>

                  <div class="flex flex-column">
                    @if (notificationsStore.error() !== null) {
                      <p class="m-0 p-3 text-red-700">Notifications unavailable.</p>
                    } @else if (notificationsStore.latestNotifications().length === 0) {
                      <p class="m-0 p-3 text-color-secondary">No notifications yet.</p>
                    } @else {
                      @for (
                        notification of notificationsStore.latestNotifications();
                        track notification.id
                      ) {
                        <article class="p-3 border-bottom-1 surface-border">
                          <p class="m-0 font-semibold text-color">{{ notification.title }}</p>
                          <p class="m-0 mt-1 line-height-3 text-color-secondary">
                            {{ notification.message }}
                          </p>
                          <p class="m-0 mt-2 text-sm text-color-secondary">
                            {{ formatDate({ date: notification.createdAt }) }}
                          </p>
                        </article>
                      }
                    }
                  </div>

                  <div class="p-3">
                    <p-button
                      [label]="notificationActionLabel()"
                      icon="pi pi-arrow-right"
                      severity="secondary"
                      [routerLink]="notificationActionLink()"
                      styleClass="w-full"
                      (onClick)="closeNotificationsPanel()"
                    />
                  </div>
                </section>
              }
            </div>
            <p-tag [value]="roleLabel()" severity="info" class="ml-2" />
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

    .navbar-link {
      color: var(--p-text-muted-color);
      font-weight: 600;
      text-decoration: none;
    }

    .navbar-link-active {
      color: var(--p-primary-color);
    }

    .notifications-panel {
      width: min(24rem, calc(100vw - 2rem));
    }
  `,
})
export class Navbar {
  private readonly authSession = inject(AuthSession);
  private readonly authenticator = inject(OAuthAuthenticator);
  protected readonly notificationsStore = inject(NotificationsStore);

  protected readonly notificationsPanelOpen = signal(false);
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.currentUser();

    return user === null ? '' : user.role.replaceAll('-', ' ');
  });
  protected readonly notificationBadgeValue = computed(() => {
    const notificationCount = this.notificationsStore.notificationCount();

    return notificationCount > 9 ? '9+' : String(notificationCount);
  });
  protected readonly notificationActionLabel = computed(() =>
    this.currentUser()?.role === 'startup-member' ? 'Open opportunities' : 'Open challenges',
  );
  protected readonly notificationActionLink = computed(() =>
    this.currentUser()?.role === 'startup-member' ? '/opportunities' : '/challenges',
  );

  protected toggleNotificationsPanel(): void {
    this.notificationsPanelOpen.update((isOpen) => !isOpen);
  }

  protected closeNotificationsPanel(): void {
    this.notificationsPanelOpen.set(false);
  }

  protected reloadNotifications(): void {
    this.notificationsStore.reloadNotifications();
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(input.date);
  }

  protected logout(): void {
    this.closeNotificationsPanel();
    this.authenticator.logout();
  }
}
