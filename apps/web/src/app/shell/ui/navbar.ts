import { Component } from '@angular/core';

@Component({
  selector: 'navbar',
  template: `
    <header
      class="flex align-items-center justify-content-between gap-3 py-3 border-bottom-1 surface-border"
    >
      <div>
        <p class="m-0 mb-1 text-color-secondary text-sm font-bold uppercase">Sparkflow</p>
        <h1 id="app-title" class="m-0 text-2xl font-bold">Open Innovation Platform</h1>
      </div>
      <!-- the navigation and user avatar will be there -->
    </header>
  `,
})
export class Navbar {}
