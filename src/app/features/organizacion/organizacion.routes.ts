import { Routes } from '@angular/router';

import { ClaveUbicacion } from './services/organizacion.service';

/** Los tres niveles comparten pantalla, así que sus rutas se generan. */
const CLAVES: ClaveUbicacion[] = ['zonas', 'sedes', 'markets'];

export const routes: Routes = CLAVES.map((clave) => ({
  path: clave,
  data: { clave },
  loadComponent: () =>
    import('./pages/ubicacion-lista/ubicacion-lista').then((m) => m.UbicacionLista),
}));
