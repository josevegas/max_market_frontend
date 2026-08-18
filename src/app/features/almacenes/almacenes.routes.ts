import { Routes } from '@angular/router';

/** Rutas del módulo de almacenes. */
export const routes: Routes = [
  {
    path: 'almacenes',
    loadComponent: () =>
      import('./pages/almacen-lista/almacen-lista').then((m) => m.AlmacenLista),
  },
  {
    path: 'stock-almacen',
    loadComponent: () =>
      import('./pages/producto-almacen-lista/producto-almacen-lista').then(
        (m) => m.ProductoAlmacenLista,
      ),
  },
  {
    path: 'lotes',
    loadComponent: () =>
      import('./pages/producto-lote-lista/producto-lote-lista').then(
        (m) => m.ProductoLoteLista,
      ),
  },
  // El maestro de unidades vive acá porque acá están su modelo y su servicio,
  // aunque en el menú aparezca junto al resto de los catálogos de producto:
  // es donde el usuario lo busca, al lado de Presentaciones.
  {
    path: 'unidades-medida',
    loadComponent: () =>
      import('./pages/unidad-medida-lista/unidad-medida-lista').then(
        (m) => m.UnidadMedidaLista,
      ),
  },
];
