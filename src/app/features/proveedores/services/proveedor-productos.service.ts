import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import {
  AsignacionProducto,
  ProductoDelProveedor,
  ProveedorDelProducto,
  ProveedorProducto,
} from '../models/catalogo.model';

/** Asignación de productos a proveedores.
 *
 * No hereda de `RecursoService`: las rutas cuelgan de la empresa
 * (`/empresas/{id}/productos`) y del producto, no de un recurso propio con los
 * cinco endpoints estándar.
 */
@Injectable({ providedIn: 'root' })
export class ProveedorProductoService {
  private readonly api = inject(ApiClient);

  /** Catálogo de un proveedor, ya ordenado por tiempo de atención. */
  productosDe(empresaId: string): Observable<ProductoDelProveedor[]> {
    return this.api.get<ProductoDelProveedor[]>(`empresas/${empresaId}/productos`);
  }

  /** Asigna un producto o corrige su plazo: el endpoint es idempotente y
   *  reactiva una asignación que estuviera dada de baja. El producto va en la
   *  ruta, así que el cuerpo lleva solo el plazo. */
  asignar(
    empresaId: string,
    productoId: string,
    tiempoAtencion: number,
  ): Observable<ProveedorProducto> {
    return this.api.put<ProveedorProducto>(
      `empresas/${empresaId}/productos/${productoId}`,
      { tiempo_atencion: tiempoAtencion },
    );
  }

  /** Alta masiva. El servidor la trata como todo o nada. */
  asignarVarios(
    empresaId: string,
    asignaciones: AsignacionProducto[],
  ): Observable<ProveedorProducto[]> {
    return this.api.post<ProveedorProducto[]>(`empresas/${empresaId}/productos`, {
      asignaciones,
    });
  }

  /** Baja lógica: la fila se conserva por las órdenes de compra históricas. */
  quitar(empresaId: string, productoId: string): Observable<ProveedorProducto> {
    return this.api.delete<ProveedorProducto>(
      `empresas/${empresaId}/productos/${productoId}`,
    );
  }

  /** Quiénes proveen un producto, del más rápido al más lento. */
  proveedoresDe(productoId: string): Observable<ProveedorDelProducto[]> {
    return this.api.get<ProveedorDelProducto[]>(`productos/${productoId}/proveedores`);
  }

  /** El de menor tiempo de atención, o `null` si nadie lo provee. */
  masRapido(productoId: string): Observable<ProveedorDelProducto | null> {
    return this.api.get<ProveedorDelProducto | null>(
      `productos/${productoId}/proveedor-mas-rapido`,
    );
  }
}
