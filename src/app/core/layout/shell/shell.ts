import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';

import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet, Toast, ConfirmDialog, Header, Sidebar],
  templateUrl: './shell.html',
})
export class Shell {
  /** En escritorio arranca abierto; en móvil, cerrado. */
  readonly sidebarAbierto = signal(this.esDesktop());

  toggleSidebar(): void {
    this.sidebarAbierto.update((v) => !v);
  }

  cerrarSidebarMobile(): void {
    if (!this.esDesktop()) this.sidebarAbierto.set(false);
  }

  private esDesktop(): boolean {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  }
}
