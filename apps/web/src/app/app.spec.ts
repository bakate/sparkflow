import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { sparkFlowPrimeNgConfig } from './shell/ui/primeng.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [providePrimeNG(sparkFlowPrimeNgConfig)],
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

    expect(compiled.querySelector('h1')?.textContent).toContain('Open Innovation Platform');
    expect(compiled.querySelector('p-button')).not.toBeNull();
    expect(compiled.querySelector('.p-button')).not.toBeNull();
  });
});
