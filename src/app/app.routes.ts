import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'productos', pathMatch: 'full' },
      {
        path: '',
        loadChildren: () =>
          import('./features/productos/productos.routes').then((m) => m.routes),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/proveedores/proveedores.routes').then((m) => m.routes),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/organizacion/organizacion.routes').then((m) => m.routes),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/almacenes/almacenes.routes').then((m) => m.routes),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/movimientos/movimientos.routes').then((m) => m.routes),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/bancos/bancos.routes').then((m) => m.routes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
