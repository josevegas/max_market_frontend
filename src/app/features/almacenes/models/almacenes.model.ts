/** Modelos del módulo de almacenes.
 *
 * Reflejan el contrato de la API (`/api/v1`). Los campos de auditoría los pone
 * el servidor y solo llegan en las respuestas, por eso no están en los tipos
 * de creación ni de edición.
 */

import { Auditoria } from '../../productos/models/catalogo.model';

/** Estado en el que puede estar el stock de un producto o un lote. Es el
 * mismo vocabulario en las dos tablas. */
export type EstadoExistencia = 'disponible' | 'agotado' | 'inmovilizado';

export const ESTADOS_EXISTENCIA: { label: string; value: EstadoExistencia }[] = [
  { label: 'Disponible', value: 'disponible' },
  { label: 'Agotado', value: 'agotado' },
  { label: 'Inmovilizado', value: 'inmovilizado' },
];

// ── Almacén ─────────────────────────────────────────────────────────────────
export interface Almacen extends Auditoria {
  market_id: string;
  nombre: string;
  codigo: string;
}
export interface AlmacenCreate {
  market_id: string;
  nombre: string;
  codigo: string;
}
export type AlmacenUpdate = Partial<AlmacenCreate>;

// ── Stock por almacén ───────────────────────────────────────────────────────
/** Lo que un almacén guarda de un producto: cuánto debe haber y a cuánto se
 * vende en tienda. El stock real sale de los movimientos, no de acá. */
export interface ProductoAlmacen extends Auditoria {
  almacen_id: string;
  producto_id: string;
  unidad_medida_id: string;
  stock_minimo: number;
  stock_maximo: number | null;
  /** Llega como string por la precisión decimal del backend. */
  precio_venta_tienda: string | number;
  estado: EstadoExistencia;
}
export interface ProductoAlmacenCreate {
  almacen_id: string;
  producto_id: string;
  unidad_medida_id: string;
  stock_minimo: number;
  stock_maximo?: number | null;
  precio_venta_tienda: number;
  estado: EstadoExistencia;
}
export type ProductoAlmacenUpdate = Partial<ProductoAlmacenCreate>;

// ── Lote ────────────────────────────────────────────────────────────────────
/** Cada ingreso de mercadería con su vencimiento. Nace de una guía de
 * remisión: es lo que ata el lote al documento que lo trajo. */
export interface ProductoLote extends Auditoria {
  guia_remision_id: string;
  producto_id: string;
  unidad_medida_id: string;
  fecha_ingreso: string;
  cantidad: number;
  codigo_lote: string;
  fecha_vencimiento: string | null;
  estado: EstadoExistencia;
}
export interface ProductoLoteCreate {
  guia_remision_id: string;
  producto_id: string;
  unidad_medida_id: string;
  fecha_ingreso: string;
  cantidad: number;
  codigo_lote: string;
  fecha_vencimiento?: string | null;
  estado: EstadoExistencia;
}
export type ProductoLoteUpdate = Partial<ProductoLoteCreate>;

// ── Catálogos que se consultan para los selectores ──────────────────────────
/** `Market` se define en el módulo de organización, que es su dueño. */
export type { Market } from '../../organizacion/models/organizacion.model';

/** Ojo: se describe con `descripcion`, no con `nombre` como el resto de los
 * catálogos. Es el contrato de `/unidades-medida`. */
export interface UnidadMedida extends Auditoria {
  descripcion: string;
  codigo: string;
  /** Cuántas unidades mínimas vale una de esta: UND → 1, CAJA12 → 12. Vive en
   * `tabla_equivalencia`, pero la API lo devuelve acá porque sin él la unidad
   * no se puede usar en un movimiento. Nulo solo en registros anteriores a que
   * el alta lo exigiera. */
  factor_conversion: number | null;
}

/** A diferencia de otros catálogos, acá el código es obligatorio: la API lo
 * declara `min_length=1`. Es lo que se imprime en documentos y lo que hace
 * legible una línea de movimiento ("12 KG"), así que no admite quedar vacío. */
export interface UnidadMedidaCreate {
  descripcion: string;
  codigo: string;
  /** La API lo escribe en `tabla_equivalencia` dentro de la misma transacción
   * que la unidad, así que no hace falta un alta aparte. */
  factor_conversion: number;
}
export type UnidadMedidaUpdate = Partial<UnidadMedidaCreate>;
