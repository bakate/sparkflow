import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OAuthAuthenticator } from '@shared/auth/oauth-authenticator';
import { App } from './app';
import { sparkFlowPrimeNgConfig } from './shell/ui/primeng.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        MessageService,
        providePrimeNG(sparkFlowPrimeNgConfig),
        provideRouter([]),
        {
          provide: OAuthAuthenticator,
          useValue: {
            logout: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the product shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Sparkflow');
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
