import { Injectable } from '@angular/core';

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
  UnidadMedida,
  UnidadMedidaCreate,
  UnidadMedidaUpdate,
} from '../models/almacenes.model';

/** Los tres recursos exponen los mismos cinco endpoints que el maestro de
 * productos, así que reutilizan `RecursoService` y solo declaran su ruta. */

@Injectable({ providedIn: 'root' })
export class AlmacenService extends RecursoService<Almacen, AlmacenCreate, AlmacenUpdate> {
  protected readonly ruta = 'almacenes';
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
