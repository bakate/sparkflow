import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shell/ui/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  template: `
    <main class="app-shell" aria-labelledby="app-title">
      <navbar />

      <router-outlet />
    </main>
  `,
  styles: `
    .app-shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 2rem;
    }
  `,
})
export class App {}
