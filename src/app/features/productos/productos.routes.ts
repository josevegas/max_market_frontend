import { Routes } from '@angular/router';

/** Rutas del maestro de productos.
 *
 * `productos/nuevo` va antes que `productos/:id` a propósito: el router
 * resuelve por orden y si no, "nuevo" se interpretaría como un id.
 */
export const routes: Routes = [
  {
    path: 'productos',
    loadComponent: () =>
      import('./pages/producto-lista/producto-lista').then((m) => m.ProductoLista),
  },
  {
    path: 'productos/nuevo',
    loadComponent: () =>
      import('./pages/producto-form/producto-form').then((m) => m.ProductoForm),
  },
  {
    path: 'productos/:id',
    loadComponent: () =>
      import('./pages/producto-form/producto-form').then((m) => m.ProductoForm),
  },
  {
    path: 'familias',
    loadComponent: () =>
      import('./pages/familia-lista/familia-lista').then((m) => m.FamiliaLista),
  },
  {
    path: 'sub-familias',
    loadComponent: () =>
      import('./pages/sub-familia-lista/sub-familia-lista').then((m) => m.SubFamiliaLista),
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./pages/categoria-lista/categoria-lista').then((m) => m.CategoriaLista),
  },
  {
    path: 'sub-categorias',
    loadComponent: () =>
      import('./pages/sub-categoria-lista/sub-categoria-lista').then(
        (m) => m.SubCategoriaLista,
      ),
  },
  {
    path: 'presentaciones',
    loadComponent: () =>
      import('./pages/presentacion-lista/presentacion-lista').then(
        (m) => m.PresentacionLista,
      ),
  },
];
