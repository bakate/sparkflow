import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { type Params, RouterLink, RouterLinkActive } from '@angular/router';
import { Button } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { Popover } from 'primeng/popover';
import { Tag } from 'primeng/tag';
import { AuthSession } from '@shared/auth/auth-session';
import { OAuthAuthenticator } from '@shared/auth/oauth-authenticator';
import { EmptyState } from '@shared/ui/empty-state';
import { NOTIFICATION_GATEWAY } from '@features/notifications/application/notification-gateway';
import { NotificationsStore } from '@features/notifications/application/notifications-store';
import type { Notification } from '@features/notifications/domain/notification';
import { HttpNotificationGateway } from '@features/notifications/infrastructure/http-notification-gateway';

@Component({
  selector: 'navbar',
  imports: [
    Button,
    EmptyState,
    NgOptimizedImage,
    OverlayBadgeModule,
    Popover,
    RouterLink,
    RouterLinkActive,
    Tag,
  ],
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
                  [value]="notificationBadgeValue()"
                  severity="danger"
                  styleClass="notification-overlay-badge"
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
                    (onClick)="notificationsPopover.toggle($event)"
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
                  (onClick)="notificationsPopover.toggle($event)"
                />
              }

              <p-popover
                #notificationsPopover
                appendTo="body"
                ariaLabel="Notifications"
                [dismissable]="true"
                [style]="{ width: 'min(24rem, calc(100vw - 2rem))' }"
                (onShow)="openNotificationsPanel()"
                (onHide)="closeNotificationsPanel()"
              >
                <div class="flex flex-column" aria-label="Notifications">
                  <div
                    class="flex align-items-center justify-content-between gap-3 pb-3 border-bottom-1 surface-border"
                  >
                    <p class="m-0 font-bold text-color">Notifications</p>
                    <div class="flex align-items-center gap-1">
                      @if (notificationsStore.unreadNotificationCount() > 0) {
                        <p-button
                          label="Mark all read"
                          severity="secondary"
                          [text]="true"
                          [loading]="notificationsStore.loading()"
                          (onClick)="markAllNotificationsRead()"
                        />
                      }
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
                  </div>

                  <div class="flex flex-column">
                    @if (notificationsStore.error() !== null) {
                      <p class="m-0 py-3 text-red-700">Notifications unavailable.</p>
                    } @else if (notificationsStore.latestNotifications().length === 0) {
                      <div class="py-3">
                        <empty-state
                          title="No notifications"
                          description="Proposal updates and decision results will appear here."
                          icon="pi pi-bell"
                          [compact]="true"
                        />
                      </div>
                    } @else {
                      @for (
                        notification of notificationsStore.latestNotifications();
                        track notification.id
                      ) {
                        <article
                          class="py-3 border-bottom-1 surface-border notification-item"
                          [class.notification-item-unread]="notification.readAt === null"
                        >
                          <div class="flex align-items-center justify-content-between gap-2">
                            <p class="m-0 font-semibold text-color">{{ notification.title }}</p>
                            @if (notification.readAt === null) {
                              <p-tag value="Unread" severity="info" />
                            }
                          </div>
                          <p class="m-0 mt-1 line-height-3 text-color-secondary">
                            {{ notification.message }}
                          </p>
                          <p class="m-0 mt-2 text-sm text-color-secondary">
                            {{ formatDate({ date: notification.createdAt }) }}
                          </p>
                          @if (notification.actionUrl !== null) {
                            <p-button
                              label="Open"
                              icon="pi pi-arrow-right"
                              severity="secondary"
                              [text]="true"
                              [routerLink]="notificationActionPath({ notification })"
                              [queryParams]="notificationActionQueryParams({ notification })"
                              (onClick)="
                                openNotification({ notification, popover: notificationsPopover })
                              "
                            />
                          }
                        </article>
                      }
                    }
                  </div>

                  <div class="pt-3">
                    <p-button
                      [label]="notificationActionLabel()"
                      icon="pi pi-arrow-right"
                      severity="secondary"
                      [routerLink]="notificationActionLink()"
                      styleClass="w-full"
                      (onClick)="notificationsPopover.hide()"
                    />
                  </div>
                </div>
              </p-popover>
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

    :host ::ng-deep .notification-overlay-badge.p-badge {
      align-items: center;
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.6875rem;
      height: 1.375rem;
      justify-content: center;
      line-height: 1;
      min-width: 1.375rem;
      padding: 0;
      width: 1.375rem;
    }

    .notification-item {
      border-left: 3px solid transparent;
      padding-left: 0.75rem;
    }

    .notification-item-unread {
      border-left-color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
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

  protected openNotificationsPanel(): void {
    this.notificationsPanelOpen.set(true);
  }

  protected closeNotificationsPanel(): void {
    this.notificationsPanelOpen.set(false);
  }

  protected reloadNotifications(): void {
    this.notificationsStore.reloadNotifications();
  }

  protected markAllNotificationsRead(): void {
    void this.notificationsStore.markAllNotificationsRead();
  }

  protected openNotification(input: {
    readonly notification: Notification;
    readonly popover: Popover;
  }): void {
    void this.notificationsStore.markNotificationRead({
      notificationId: input.notification.id,
    });
    input.popover.hide();
  }

  protected notificationActionPath(input: { readonly notification: Notification }): string {
    const actionUrl = input.notification.actionUrl;

    if (actionUrl === null) {
      return this.notificationActionLink();
    }

    return parseNotificationActionUrl({ actionUrl }).path;
  }

  protected notificationActionQueryParams(input: {
    readonly notification: Notification;
  }): Params | null {
    const actionUrl = input.notification.actionUrl;

    if (actionUrl === null) {
      return null;
    }

    return parseNotificationActionUrl({ actionUrl }).queryParams;
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

const parseNotificationActionUrl = (input: {
  readonly actionUrl: string;
}): { readonly path: string; readonly queryParams: Params | null } => {
  const parsedUrl = new URL(input.actionUrl, 'http://sparkflow.local');
  const queryParams: Params = {};

  parsedUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  return {
    path: parsedUrl.pathname,
    queryParams: Object.keys(queryParams).length === 0 ? null : queryParams,
  };
};
