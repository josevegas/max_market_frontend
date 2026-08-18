/** Modelos del módulo de movimientos.
 *
 * Los cinco documentos forman una cadena: cada uno nace del anterior.
 *
 *   requerimiento → pedido → cotización → orden de compra → guía de remisión
 *
 * Todos comparten la misma forma —`estado_id`, `fecha` y el FK del documento
 * que los origina— y un detalle de líneas con producto, unidad y cantidad. Eso
 * es lo que permite que una sola pantalla los edite a los cinco.
 */

import { Auditoria } from '../../productos/models/catalogo.model';

// ── Estado ──────────────────────────────────────────────────────────────────
/** Maestro compartido por los cinco documentos (pendiente, aprobado, etc.). */
export interface Estado extends Auditoria {
  descripcion: string;
  codigo: string;
}
export interface EstadoCreate {
  descripcion: string;
  codigo: string;
}
export type EstadoUpdate = Partial<EstadoCreate>;

// ── Cabeceras ───────────────────────────────────────────────────────────────
export interface Requerimiento extends Auditoria {
  almacen_id: string;
  estado_id: string;
  fecha: string;
}
export interface Pedido extends Auditoria {
  requerimiento_id: string;
  estado_id: string;
  fecha: string;
}
export interface Cotizacion extends Auditoria {
  pedido_id: string;
  proveedor_id: string;
  estado_id: string;
  /** Días que el proveedor tarda en atender, contados desde el pedido. */
  tiempo_atencion: number;
  fecha: string;
  /** Lo calcula el servidor sumando las líneas; no se envía al crear. */
  monto_total: string | number;
}
export interface OrdenCompra extends Auditoria {
  cotizacion_id: string;
  estado_id: string;
  fecha: string;
  monto_total: string | number;
}
export interface GuiaRemision extends Auditoria {
  orden_compra_id: string;
  estado_id: string;
  fecha: string;
}

/** La recepción cierra la cadena: es el papel que dice que la mercadería entró.
 *
 * Queda fuera de la pantalla genérica a propósito. No nace de un padre
 * aprobado como los otros cinco —nace de una guía **entregada**—, admite
 * colgar de la orden de compra cuando el proveedor entrega sin guía previa, y
 * su detalle lleva tres cantidades en vez de una. Forzarla en el molde común
 * habría llenado el molde de excepciones.
 *
 * Al crearla el servidor deja la guía en `RECEPCIONADO` y arrastra la orden,
 * la cotización, el pedido y el requerimiento a `ATENDIDO`, todo en la misma
 * transacción. Por eso el alta no manda `estado_id`: lo pone él.
 */
export interface Recepcion extends Auditoria {
  guia_remision_id: string | null;
  orden_compra_id: string | null;
  factura_id: string | null;
  almacen_id: string;
  estado_id: string;
  fecha: string;
  observaciones: string | null;
}

export interface RecepcionCreate {
  /** Una de las dos es obligatoria: sin guía ni orden no se sabe qué se está
   * recibiendo. Si van las dos, tienen que decir lo mismo. */
  guia_remision_id?: string | null;
  orden_compra_id?: string | null;
  almacen_id: string;
  /** Se omite en el alta: registrar la recepción **es** recepcionar, así que
   * el servidor le pone `RECEPCIONADO`. */
  estado_id?: string | null;
  fecha: string;
  observaciones?: string | null;
}
export type RecepcionUpdate = Partial<RecepcionCreate>;

/** Línea de recepción. Tres cantidades y no una: lo que la guía declaraba, lo
 * que se aceptó y lo que se devolvió. Con una sola no se distingue "no lo
 * trajeron" de "lo trajeron mal", que es justo lo que se le reclama al
 * proveedor. */
export interface RecepcionDetalle extends Auditoria {
  recepcion_id: string;
  producto_id: string;
  unidad_medida_id: string;
  cantidad_esperada: number;
  cantidad_ingresada: number;
  cantidad_devuelta: number;
  precio_unitario: string | number;
  codigo_lote: string | null;
}

/** Línea de recepción en edición: puede no existir todavía en el servidor. */
export interface LineaRecepcion {
  /** Id del servidor. Ausente = línea nueva, todavía sin guardar. */
  id?: string;
  producto_id: string | null;
  unidad_medida_id: string | null;
  cantidad_esperada: number;
  cantidad_ingresada: number;
  cantidad_devuelta: number;
  precio_unitario: number;
  codigo_lote: string | null;
}

/** Lo que cualquiera de los cinco expone, visto por la pantalla genérica. */
export interface DocumentoCabecera extends Auditoria {
  estado_id: string;
  fecha: string;
  monto_total?: string | number;
  tiempo_atencion?: number;
  proveedor_id?: string;
  [campo: string]: unknown;
}

// ── Detalles ────────────────────────────────────────────────────────────────
/** Línea de cualquiera de los cinco documentos.
 *
 * `precio_unitario` y `monto_producto` solo existen en cotización y orden de
 * compra: los otros tres mueven cantidades, no dinero. `monto_producto` lo
 * calcula el servidor (`cantidad * precio_unitario`), así que nunca se envía.
 */
export interface DocumentoDetalle extends Auditoria {
  producto_id: string;
  unidad_medida_id: string;
  cantidad: number;
  precio_unitario?: string | number;
  monto_producto?: string | number;
  [campo: string]: unknown;
}

/** Línea en edición: puede no existir todavía en el servidor. */
export interface LineaEditable {
  /** Id del servidor. Ausente = línea nueva, todavía sin guardar. */
  id?: string;
  producto_id: string | null;
  unidad_medida_id: string | null;
  cantidad: number;
  precio_unitario: number;
}
