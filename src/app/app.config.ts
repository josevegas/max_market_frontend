import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';

import { routes } from './app.routes';

/** Misma mecánica que en rentcar: el preset de PrimeNG y la paleta `brand` de
 *  Tailwind comparten los mismos valores, para que un `p-button` y un botón
 *  con clases utilitarias se vean igual. Los tonos salen del logo. */
const MaxMarketPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff1f3',
      100: '#ffe1e6',
      200: '#ffc7d1',
      300: '#ff9caf',
      400: '#ff6183',
      500: '#FA0A32',
      600: '#e30029',
      700: '#bf0023',
      800: '#9e0621',
      900: '#860b21',
      950: '#4b000d',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    MessageService,
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: MaxMarketPreset,
        options: { darkModeSelector: '.dark-mode' },
      },
    }),
  ],
};
