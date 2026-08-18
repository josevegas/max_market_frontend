import { Routes } from '@angular/router';

/** Rutas del módulo de bancos.
 *
 * Los tres maestros son listas sueltas: el banco y el tipo de cuenta no tienen
 * ficha propia, y la cuenta se edita en un diálogo desde su lista.
 */
export const routes: Routes = [
  {
    path: 'bancos',
    loadComponent: () =>
      import('./pages/banco-lista/banco-lista').then((m) => m.BancoLista),
  },
  {
    path: 'tipos-cuenta',
    loadComponent: () =>
      import('./pages/tipo-cuenta-lista/tipo-cuenta-lista').then((m) => m.TipoCuentaLista),
  },
  {
    path: 'cuentas',
    loadComponent: () =>
      import('./pages/cuenta-lista/cuenta-lista').then((m) => m.CuentaLista),
  },
];
