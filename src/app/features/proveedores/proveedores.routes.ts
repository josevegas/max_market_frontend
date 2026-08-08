import { Routes } from '@angular/router';

/** Rutas del maestro de proveedores.
 *
 * `empresas/nuevo` va antes que `empresas/:id` a propósito: el router resuelve
 * por orden y si no, "nuevo" se interpretaría como un id.
 */
export const routes: Routes = [
  {
    path: 'empresas',
    loadComponent: () =>
      import('./pages/empresa-lista/empresa-lista').then((m) => m.EmpresaLista),
  },
  {
    path: 'empresas/nuevo',
    loadComponent: () =>
      import('./pages/empresa-form/empresa-form').then((m) => m.EmpresaForm),
  },
  {
    path: 'empresas/:id',
    loadComponent: () =>
      import('./pages/empresa-form/empresa-form').then((m) => m.EmpresaForm),
  },
];
