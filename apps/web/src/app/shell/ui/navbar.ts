import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'navbar',
  imports: [NgOptimizedImage, RouterLink],
  template: `
    <header class="p-3 mb-4 navbar-shadow border-bottom-1 ">
      <div class="flex align-items-center justify-content-between gap-3 navbar-logo">
        <a routerLink="/" class="flex gap-2 align-items-center navbar-logo">
          <img ngSrc="/logo.png" alt="sparkflow logo" width="40" height="40" />
          <span class="mr-1 uppercase text-primary"> Sparkflow </span>
        </a>

        <!-- <div>
        <p class="m-0 mb-1 text-color-secondary text-sm font-bold uppercase">Sparkflow</p>
        <h1 id="app-title" class="m-0 text-2xl font-bold">Open Innovation Platform</h1>
      </div> -->
        <!-- the navigation and user avatar will be there -->
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
export class Navbar {}
