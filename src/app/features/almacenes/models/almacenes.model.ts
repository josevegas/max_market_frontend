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
/** Cada ingreso de mercadería con su vencimiento, en el almacén donde quedó.
 *
 * El lote es la unidad de stock: no lleva unidad de medida propia, su
 * `cantidad` va siempre en la **unidad de venta del producto**, que es en la
 * que el market mueve el stock. La guía viene en la unidad de compra y la API
 * convierte entre las dos.
 */
export interface ProductoLote extends Auditoria {
  /** Dónde está la mercadería. Es lo que hace el stock atribuible a un
   * almacén y comparable contra el mínimo de `ProductoAlmacen`. */
  almacen_id: string;
  /** Nulo cuando el lote entró por una recepción contra orden de compra
   * directa: el proveedor entregó sin guía previa. */
  guia_remision_id: string | null;
  producto_id: string;
  fecha_ingreso: string;
  cantidad: number;
  /** Lo que costó una unidad **de venta** de este lote. La línea de recepción
   * cobra en su propia unidad y la API convierte al guardarlo, así que este
   * número es comparable entre lotes. Llega como string por la precisión
   * decimal del backend. */
  precio_compra: string | number;
  codigo_lote: string;
  fecha_vencimiento: string | null;
  /** Con cuántos días de antelación avisar del vencimiento. Nulo si el
   * producto no caduca o si nadie lo configuró. */
  dias_alerta_vencimiento: number | null;
  estado: EstadoExistencia;
}
export interface ProductoLoteCreate {
  almacen_id: string;
  guia_remision_id?: string | null;
  producto_id: string;
  fecha_ingreso: string;
  cantidad: number;
  precio_compra?: number;
  codigo_lote: string;
  fecha_vencimiento?: string | null;
  dias_alerta_vencimiento?: number | null;
  estado: EstadoExistencia;
}
export type ProductoLoteUpdate = Partial<ProductoLoteCreate>;

// ── Stock que suman los lotes ───────────────────────────────────────────────
/** Lo que hay de un producto en un almacén, contra lo que debería haber.
 *
 * No es una tabla: lo calcula la API sumando los lotes **disponibles** de ese
 * almacén (lo agotado o inmovilizado está ahí pero no se puede vender). Es la
 * respuesta de `GET /almacenes/{id}/stock`.
 */
export interface StockDeProducto {
  producto_id: string;
  /** En qué unidad está `disponible`. Viene explícito porque el mínimo de la
   * ficha puede estar en otra, y sin decirlo el número sería ambiguo. */
  unidad_venta_id: string;
  disponible: number;
  stock_minimo: number | null;
  stock_maximo: number | null;
  /** Ya comparado **en unidad mínima** por el servidor: la ficha y el lote no
   * tienen por qué estar en la misma unidad, así que el cliente no puede
   * deducirlo dividiendo los dos números de arriba. */
  bajo_minimo: boolean;
  /** `false` cuando hay mercadería pero nadie creó la ficha del producto en
   * este almacén: hay stock sin un mínimo contra el cual medirlo. */
  tiene_ficha: boolean;
}

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
