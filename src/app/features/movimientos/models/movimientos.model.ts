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
  /** Días de crédito que ofrece el proveedor: 0 es contado. Uno de los cuatro
   * criterios del comparativo, y el único que no se deriva de otra columna. */
  condicion_pago_dias: number;
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

/** Línea de recepción. Tres cantidades y no una: lo que la guía declaraba
 * (`cantidad_esperada`), lo que se aceptó (`cantidad_ingresada`) y lo que no
 * —faltó o se rechazó— (`cantidad_devuelta`). Con una sola no se distingue "no
 * lo trajeron" de "lo trajeron mal", que es justo lo que se le reclama al
 * proveedor.
 *
 * Cuadran entre sí: `esperada = ingresada + devuelta`. Al stock entra
 * `cantidad_ingresada` sola, porque ya es lo aceptado. */
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
  /** Solo en la cotización, como `tiempo_atencion`. */
  condicion_pago_dias?: number;
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

// ── Comparativo de cotizaciones ─────────────────────────────────────────────
/** Las claves de los cuatro criterios, tal como las indexa la API. */
export type ClaveCriterio = 'precio' | 'entrega' | 'stock' | 'pago';

/** Cómo se rotula cada criterio en pantalla, y qué quiere decir su número.
 *
 * Vive acá y no en el componente porque el orden es el de las columnas de la
 * matriz, y ese orden es parte del contrato con la API: es el mismo en el que
 * el negocio los enunció (precio, entrega, stock, pago).
 */
export const CRITERIOS: {
  clave: ClaveCriterio;
  etiqueta: string;
  /** Unidad del valor crudo, para no mostrar un número sin dimensión. */
  unidad: string;
  /** Qué dirección es mejor, que es lo que hace legible el puntaje. */
  mejor: 'menor' | 'mayor';
  ayuda: string;
}[] = [
  {
    clave: 'precio',
    etiqueta: 'Precio',
    unidad: 'por unidad',
    mejor: 'menor',
    ayuda:
      'Monto por unidad atendida, no monto total: cada cotización cubre los ' +
      'productos que su proveedor distribuye, así que comparar totales premiaría ' +
      'a quien cotiza menos.',
  },
  {
    clave: 'entrega',
    etiqueta: 'Entrega',
    unidad: 'días',
    mejor: 'menor',
    ayuda: 'Días que el proveedor tarda en atender, desde el pedido.',
  },
  {
    clave: 'stock',
    etiqueta: 'Stock atendido',
    unidad: '%',
    mejor: 'mayor',
    ayuda:
      'Qué parte de lo que pide el pedido cubre esta cotización, medido en ' +
      'unidad mínima. Cotizar de más no sube del 100%.',
  },
  {
    clave: 'pago',
    etiqueta: 'Condición de pago',
    unidad: 'días',
    mejor: 'mayor',
    ayuda: 'Días de crédito que ofrece el proveedor. 0 es contado.',
  },
];

/** Un criterio ya evaluado. Los decimales llegan como string por la precisión
 * del backend, igual que `monto_total`. */
export interface CriterioEvaluado {
  /** El valor crudo, en la unidad del criterio. Nulo cuando no se puede medir:
   * una cotización sin líneas no tiene precio por unidad. */
  valor: string | number | null;
  /** 0 a 100, contra el mejor valor del grupo. */
  puntaje: string | number;
  /** Lo que aporta al total: `puntaje * peso / 100`. */
  aporte: string | number;
}

export interface CotizacionEvaluada {
  cotizacion_id: string;
  proveedor_id: string;
  proveedor: string;
  estado_id: string;
  estado: string;
  monto_total: string | number;
  tiempo_atencion: number;
  condicion_pago_dias: number;
  unidades_atendidas: number;
  precio_por_unidad: string | number | null;
  cobertura: string | number;
  /** Productos del pedido que esta cotización no cotiza: la explicación de una
   * cobertura baja. */
  productos_sin_cotizar: string[];
  criterios: Record<ClaveCriterio, CriterioEvaluado>;
  puntaje_total: string | number;
  /** La de mayor puntaje. Puede venir en más de una si empatan exacto. */
  optimo: boolean;
}

/** El cuadro de decisión completo, tal como lo devuelve la API. */
export interface Comparativo {
  pedido_id: string;
  requerimiento_id: string;
  /** Unidades mínimas que pide el pedido: el denominador de la cobertura. */
  unidades_pedidas: number;
  /** Los pesos con los que se calculó. Se rotulan desde acá y no se repiten en
   * el componente, para que no queden desincronizados si cambian. */
  pesos: Record<ClaveCriterio, number>;
  /** De mayor a menor puntaje. Sin las rechazadas. */
  cotizaciones: CotizacionEvaluada[];
}
