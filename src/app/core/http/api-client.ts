import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../config/environment';
import { AppError, kindFromStatus } from './api-error';

export interface ApiRequestOptions {
  params?: HttpParams | Record<string, unknown>;
}

/** Punto único de acceso a la API: arma la URL y normaliza los errores. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.pedir(this.http.get<T>(this.url(path), this.opciones(options)));
  }

  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.pedir(this.http.post<T>(this.url(path), body, this.opciones(options)));
  }

  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.pedir(this.http.put<T>(this.url(path), body, this.opciones(options)));
  }

  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.pedir(this.http.patch<T>(this.url(path), body, this.opciones(options)));
  }

  delete<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.pedir(this.http.delete<T>(this.url(path), this.opciones(options)));
  }

  private url(path: string): string {
    const limpio = path.startsWith('/') ? path.slice(1) : path;
    const base = this.base.endsWith('/') ? this.base : `${this.base}/`;
    return `${base}${limpio}`;
  }

  private opciones(options: ApiRequestOptions): { params?: HttpParams } {
    if (options.params === undefined) return {};
    return {
      params:
        options.params instanceof HttpParams
          ? options.params
          : aHttpParams(options.params),
    };
  }

  private pedir<T>(peticion: Observable<T>): Observable<T> {
    return peticion.pipe(catchError((err) => throwError(() => aAppError(err))));
  }
}

/** Los parámetros nulos se omiten: si no, viajan como "null" en la query. */
function aHttpParams(obj: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(obj)) {
    if (valor === null || valor === undefined || valor === '') continue;
    params = params.set(clave, String(valor));
  }
  return params;
}

export function aAppError(err: unknown): AppError {
  if (err instanceof HttpErrorResponse) {
    const cuerpo = (err.error ?? {}) as { detail?: unknown };
    return {
      kind: kindFromStatus(err.status),
      message: mensajeDeDetail(cuerpo.detail) ?? err.message ?? 'Error de comunicación con el servidor',
      status: err.status,
      cause: err,
    };
  }
  return {
    kind: 'unknown',
    message: err instanceof Error ? err.message : 'Error desconocido',
    status: 0,
    cause: err,
  };
}

/** FastAPI devuelve `detail` como texto, o como lista de errores en un 422. */
function mensajeDeDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const campo = Array.isArray(e?.loc) ? e.loc.slice(1).join('.') : '';
        return campo ? `${campo}: ${e?.msg}` : e?.msg;
      })
      .filter(Boolean)
      .join(' · ');
  }
  return null;
}
