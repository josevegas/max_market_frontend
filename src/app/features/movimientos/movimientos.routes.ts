import { Routes } from '@angular/router';

import { ClaveDocumento } from './services/movimientos.service';

/** Los cinco documentos comparten pantalla, así que sus rutas se generan.
 *
 * `nuevo` va antes que `:id` a propósito: el router resuelve por orden y si no,
 * "nuevo" se interpretaría como un id.
 */
const CLAVES: ClaveDocumento[] = [
  'requerimientos',
  'pedidos',
  'cotizaciones',
  'ordenes-compra',
  'guias-remision',
];

const rutasDocumentos: Routes = CLAVES.flatMap((clave) => [
  {
    path: clave,
    data: { clave },
    loadComponent: () =>
      import('./pages/documento-lista/documento-lista').then((m) => m.DocumentoLista),
  },
  {
    path: `${clave}/nuevo`,
    data: { clave },
    loadComponent: () =>
      import('./pages/documento-form/documento-form').then((m) => m.DocumentoForm),
  },
  {
    path: `${clave}/:id`,
    data: { clave },
    loadComponent: () =>
      import('./pages/documento-form/documento-form').then((m) => m.DocumentoForm),
  },
]);

export const routes: Routes = [
  // Antes de las generadas: `cotizaciones/comparar/:pedidoId` tiene que ganarle
  // a `cotizaciones/:id`, que si no interpretaría "comparar" como un id.
  {
    path: 'cotizaciones/comparar/:pedidoId',
    loadComponent: () =>
      import('./pages/comparativo-cotizaciones/comparativo-cotizaciones').then(
        (m) => m.ComparativoCotizaciones,
      ),
  },
  {
    path: 'estados',
    loadComponent: () =>
      import('./pages/estado-lista/estado-lista').then((m) => m.EstadoLista),
  },
  ...rutasDocumentos,
  // La recepción va aparte de las generadas: no comparte la forma de los otros
  // cinco documentos (ver `Recepcion` en el modelo). `nueva` antes que `:id`
  // por el mismo motivo de orden que arriba.
  {
    path: 'recepciones',
    loadComponent: () =>
      import('./pages/recepcion-lista/recepcion-lista').then((m) => m.RecepcionLista),
  },
  {
    path: 'recepciones/nueva',
    loadComponent: () =>
      import('./pages/recepcion-form/recepcion-form').then((m) => m.RecepcionForm),
  },
  {
    path: 'recepciones/:id',
    loadComponent: () =>
      import('./pages/recepcion-form/recepcion-form').then((m) => m.RecepcionForm),
  },
];
