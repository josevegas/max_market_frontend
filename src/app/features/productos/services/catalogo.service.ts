import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import { ParamsListado } from '../models/catalogo.model';

/** CRUD contra un recurso de la API.
 *
 * Los siete recursos del maestro exponen los mismos cinco endpoints, así que
 * se resuelve una vez acá y cada servicio concreto solo declara su ruta.
 */
export abstract class RecursoService<T, TCreate, TUpdate> {
  protected readonly api = inject(ApiClient);
  protected abstract readonly ruta: string;

  listar(params: ParamsListado = {}): Observable<T[]> {
    return this.api.get<T[]>(this.ruta, { params: params as Record<string, unknown> });
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
