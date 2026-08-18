import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, map, of } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import { ParamsListado } from '../models/catalogo.model';

/** Tope de `limite` que acepta la API (`LIMITE_MAXIMO` en `paginacion.py`).
 *
 * Pedir más devuelve 422 antes de entrar al handler, así que ningún llamado
 * puede superarlo. Vive acá para que las pantallas no lo repitan a mano: varias
 * pedían 1000 «por si acaso» y quedaban rotas sin que nada lo delatara hasta
 * abrirlas. */
export const LIMITE_MAXIMO = 500;

/** Un tramo de un listado, tal como lo devuelve la API. */
export interface Pagina<T> {
  items: T[];
  /** Registros que cumplen el filtro, ignorando `limite` y `desplazamiento`. */
  total: number;
  limite: number;
  desplazamiento: number;
}

/** CRUD contra un recurso de la API.
 *
 * Los recursos exponen los mismos cinco endpoints, así que se resuelve una vez
 * acá y cada servicio concreto solo declara su ruta.
 */
export abstract class RecursoService<T, TCreate, TUpdate> {
  protected readonly api = inject(ApiClient);
  protected abstract readonly ruta: string;

  /** Los registros del tramo pedido.
   *
   * El listado devuelve un sobre `{items, total, ...}`, no el arreglo pelado.
   * Casi ningún consumidor necesita el total, así que acá se desenvuelve y
   * quien lo necesite usa `listarPagina()`. Cuando el backend pasó a paginar,
   * este único método fue lo que hubo que tocar.
   */
  listar(params: ParamsListado = {}): Observable<T[]> {
    return this.listarPagina(params).pipe(map((pagina) => pagina.items));
  }

  /** El tramo completo, con el total, para las pantallas que paginan. */
  listarPagina(params: ParamsListado = {}): Observable<Pagina<T>> {
    return this.api.get<Pagina<T>>(this.ruta, {
      params: params as Record<string, unknown>,
    });
  }

  /** Todos los registros que cumplen el filtro, recorriendo las páginas.
   *
   * Para las pantallas que necesitan el conjunto entero y no un tramo: los
   * combos de un formulario, y las listas que filtran y ordenan en el cliente.
   * Antes lo resolvían pidiendo `limite: 1000`, que la API rechaza; bajarlo al
   * tope habría cambiado el 422 por un truncado en silencio, que es peor —el
   * combo queda incompleto y nadie se entera.
   *
   * Pide de a `LIMITE_MAXIMO` y encadena hasta juntar `total`. Con catálogos
   * chicos es una sola petición, la misma que antes.
   */
  listarTodo(params: ParamsListado = {}): Observable<T[]> {
    const pedir = (desplazamiento: number, previos: T[]): Observable<T[]> =>
      this.listarPagina({
        ...params,
        limite: LIMITE_MAXIMO,
        desplazamiento,
      }).pipe(
        concatMap((pagina) => {
          const juntos = previos.concat(pagina.items);
          // `pagina.items.length === 0` corta también si `total` viniera mal:
          // sin esa guarda un total inflado dejaría el encadenado girando.
          if (juntos.length >= pagina.total || pagina.items.length === 0) {
            return of(juntos);
          }
          return pedir(juntos.length, juntos);
        }),
      );

    return pedir(0, []);
  }

  obtener(id: string): Observable<T> {
    return this.api.get<T>(`${this.ruta}/${id}`);
  }

  crear(datos: TCreate): Observable<T> {
    return this.api.post<T>(this.ruta, datos);
  }

  actualizar(id: string, datos: TUpdate): Observable<T> {
    return this.api.patch<T>(`${this.ruta}/${id}`, datos);
  }

  /** Baja lógica: el registro se conserva y deja de listarse. */
  desactivar(id: string): Observable<T> {
    return this.api.delete<T>(`${this.ruta}/${id}`);
  }
}
