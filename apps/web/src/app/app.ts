import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shell/ui/navbar';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Toast],
  template: `
    <main class="app-shell" aria-labelledby="app-title">
      <navbar />
      <router-outlet />
    </main>
    <p-toast />
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
