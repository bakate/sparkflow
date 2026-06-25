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
    <header class="p-3 mb-4 navbar-shell navbar-shadow border-bottom-1">
      <div class="navbar-layout">
        <div class="navbar-brand-row">
          <a
            routerLink="/"
            class="flex gap-2 align-items-center navbar-logo"
            aria-label="Sparkflow home"
          >
            <img ngSrc="/logo.png" alt="sparkflow logo" width="40" height="40" />
            <span class="mr-1 uppercase text-primary">Sparkflow</span>
          </a>

          @if (currentUser(); as user) {
            @if (user.role === 'startup-member') {
              <nav class="navbar-primary-nav" aria-label="Primary navigation">
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
              </nav>
            }
          }
        </div>

        @if (currentUser(); as user) {
          <div class="navbar-actions">
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
    .navbar-shell {
      --navbar-muted-border: color-mix(in srgb, var(--p-surface-border) 75%, transparent);
    }

    .navbar-layout {
      align-items: center;
      display: flex;
      gap: 1rem;
      justify-content: space-between;
      min-width: 0;
    }

    .navbar-brand-row {
      align-items: center;
      display: flex;
      flex: 1 1 auto;
      gap: 1.25rem;
      min-width: 0;
    }

    .navbar-logo {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      text-decoration: none;
      color: inherit;
      font-size: 1.5rem;
      font-weight: 600;
      min-width: 0;
    }

    .navbar-logo span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .navbar-primary-nav {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      min-width: 0;
    }

    .navbar-link {
      color: var(--p-text-muted-color);
      font-weight: 600;
      line-height: 1;
      padding: 0.375rem 0;
      text-decoration: none;
    }

    .navbar-link-active {
      color: var(--p-primary-color);
    }

    .navbar-actions {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      gap: 0.75rem;
      justify-content: flex-end;
      min-width: 0;
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

    @media (max-width: 48rem) {
      .navbar-layout {
        align-items: stretch;
        flex-direction: column;
      }

      .navbar-brand-row {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.875rem;
        width: 100%;
      }

      .navbar-logo {
        font-size: 1.35rem;
      }

      .navbar-primary-nav {
        display: grid;
        gap: 0.5rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
      }

      .navbar-link {
        align-items: center;
        border: 1px solid var(--navbar-muted-border);
        border-radius: 6px;
        display: inline-flex;
        justify-content: center;
        min-height: 2.5rem;
        padding: 0 0.75rem;
        text-align: center;
      }

      .navbar-link-active {
        background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
        border-color: color-mix(in srgb, var(--p-primary-color) 36%, var(--p-surface-border));
      }

      .navbar-actions {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        width: 100%;
      }

      .navbar-actions p-tag {
        min-width: 0;
        text-align: center;
      }
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
