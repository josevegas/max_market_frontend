import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const CLAVE_TEMA = 'maxmarket.theme';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
})
export class Header {
  @Output() toggleSidebar = new EventEmitter<void>();

  readonly oscuro = signal(
    typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark-mode'),
  );

  /** La preferencia se guarda para que `index.html` la aplique antes de
   *  pintar y no haya parpadeo al recargar. */
  alternarTema(): void {
    const oscuro = !this.oscuro();
    this.oscuro.set(oscuro);
    document.documentElement.classList.toggle('dark-mode', oscuro);
    try {
      localStorage.setItem(CLAVE_TEMA, oscuro ? 'dark' : 'light');
    } catch {
      // Modo privado sin storage: el tema simplemente no persiste.
    }
  }
}
