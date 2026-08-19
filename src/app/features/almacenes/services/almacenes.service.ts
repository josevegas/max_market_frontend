import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { RecursoService } from '../../productos/services/catalogo.service';
import {
  Almacen,
  AlmacenCreate,
  AlmacenUpdate,
  ProductoAlmacen,
  ProductoAlmacenCreate,
  ProductoAlmacenUpdate,
  ProductoLote,
  ProductoLoteCreate,
  ProductoLoteUpdate,
  StockDeProducto,
  UnidadMedida,
  UnidadMedidaCreate,
  UnidadMedidaUpdate,
} from '../models/almacenes.model';

/** Los tres recursos exponen los mismos cinco endpoints que el maestro de
 * productos, así que reutilizan `RecursoService` y solo declaran su ruta. */

@Injectable({ providedIn: 'root' })
export class AlmacenService extends RecursoService<Almacen, AlmacenCreate, AlmacenUpdate> {
  protected readonly ruta = 'almacenes';

  /** Cuánto hay de cada producto en este almacén, sumando sus lotes.
   *
   * Cuelga del almacén y no de un recurso propio porque el stock no es una
   * tabla: es lo que suman los lotes. Devuelve la lista pelada, sin el sobre
   * `{items, total}` de los listados, así que no pasa por `RecursoService`.
   *
   * Solo aparecen los productos que tienen algún lote: uno con ficha pero sin
   * mercadería no viene en la respuesta, y su stock es cero.
   */
  stock(almacenId: string, soloBajoMinimo = false): Observable<StockDeProducto[]> {
    return this.api.get<StockDeProducto[]>(`${this.ruta}/${almacenId}/stock`, {
      params: { bajo_minimo: soloBajoMinimo },
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ProductoAlmacenService extends RecursoService<
  ProductoAlmacen,
  ProductoAlmacenCreate,
  ProductoAlmacenUpdate
> {
  protected readonly ruta = 'productos-almacen';
}

@Injectable({ providedIn: 'root' })
export class ProductoLoteService extends RecursoService<
  ProductoLote,
  ProductoLoteCreate,
  ProductoLoteUpdate
> {
  protected readonly ruta = 'productos-lote';
}

/** El maestro de markets vive en `organizacion`, que es donde se administra.
 * Acá solo se reexporta para el selector del almacén, y así no hay dos
 * servicios apuntando a la misma ruta. */
export { MarketService } from '../../organizacion/services/organizacion.service';

@Injectable({ providedIn: 'root' })
export class UnidadMedidaService extends RecursoService<
  UnidadMedida,
  UnidadMedidaCreate,
  UnidadMedidaUpdate
> {
  protected readonly ruta = 'unidades-medida';
}
