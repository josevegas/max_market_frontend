import { ClaveDocumento } from '../services/movimientos.service';

/** Qué distingue a cada documento de los otros cuatro.
 *
 * Todo lo demás —cabecera con estado y fecha, detalle de líneas, alta, edición
 * y baja— es idéntico, así que la lista y el editor son una sola pantalla que
 * se configura con esta tabla. Agregar un sexto documento es agregar una
 * entrada acá, no copiar dos componentes más.
 */
export interface TipoDocumento {
  clave: ClaveDocumento;
  /** Título en plural, para la lista. */
  titulo: string;
  /** En singular y minúscula, para los mensajes ("se creó el pedido"). */
  singular: string;
  articulo: 'el' | 'la';
  descripcion: string;
  icono: string;

  /** Documento del que nace este. `null` solo en el requerimiento, que es el
   * principio de la cadena y cuelga de un almacén. */
  origen: {
    /** Campo de la cabecera (`requerimiento_id`, `pedido_id`...). */
    campo: string;
    etiqueta: string;
    /** De dónde salen las opciones: otra clave de documento, o `almacenes`. */
    fuente: ClaveDocumento | 'almacenes';
  };

  /** Campo con el que el detalle apunta a su cabecera. */
  campoPadre: string;

  /** Cotización y orden de compra mueven dinero; los otros tres, cantidades. */
  conPrecio: boolean;
  /** Solo la cotización elige proveedor y plazo de atención. */
  conProveedor: boolean;

  /** Mínimo por línea. La guía admite 0 para registrar lo que el proveedor no
   * llegó a entregar; en el resto una línea de 0 no significa nada. */
  cantidadMinima: number;
}

export const TIPOS_DOCUMENTO: Record<ClaveDocumento, TipoDocumento> = {
  requerimientos: {
    clave: 'requerimientos',
    titulo: 'Requerimientos',
    singular: 'requerimiento',
    articulo: 'el',
    descripcion: 'Lo que un almacén necesita reponer',
    icono: 'pi-file-edit',
    origen: { campo: 'almacen_id', etiqueta: 'Almacén', fuente: 'almacenes' },
    campoPadre: 'requerimiento_id',
    conPrecio: false,
    conProveedor: false,
    cantidadMinima: 1,
  },
  pedidos: {
    clave: 'pedidos',
    titulo: 'Pedidos',
    singular: 'pedido',
    articulo: 'el',
    descripcion: 'El requerimiento ya aprobado, listo para cotizar',
    icono: 'pi-shopping-cart',
    origen: {
      campo: 'requerimiento_id',
      etiqueta: 'Requerimiento',
      fuente: 'requerimientos',
    },
    campoPadre: 'pedido_id',
    conPrecio: false,
    conProveedor: false,
    cantidadMinima: 1,
  },
  cotizaciones: {
    clave: 'cotizaciones',
    titulo: 'Cotizaciones',
    singular: 'cotización',
    articulo: 'la',
    descripcion: 'Qué precio y qué plazo ofrece cada proveedor',
    icono: 'pi-dollar',
    origen: { campo: 'pedido_id', etiqueta: 'Pedido', fuente: 'pedidos' },
    campoPadre: 'cotizacion_id',
    conPrecio: true,
    conProveedor: true,
    cantidadMinima: 1,
  },
  'ordenes-compra': {
    clave: 'ordenes-compra',
    titulo: 'Órdenes de compra',
    singular: 'orden de compra',
    articulo: 'la',
    descripcion: 'La cotización elegida, ya comprometida con el proveedor',
    icono: 'pi-check-square',
    origen: { campo: 'cotizacion_id', etiqueta: 'Cotización', fuente: 'cotizaciones' },
    campoPadre: 'orden_compra_id',
    conPrecio: true,
    conProveedor: false,
    cantidadMinima: 1,
  },
  'guias-remision': {
    clave: 'guias-remision',
    titulo: 'Guías de remisión',
    singular: 'guía de remisión',
    articulo: 'la',
    descripcion: 'Lo que el proveedor entregó de verdad',
    icono: 'pi-truck',
    origen: {
      campo: 'orden_compra_id',
      etiqueta: 'Orden de compra',
      fuente: 'ordenes-compra',
    },
    campoPadre: 'guia_remision_id',
    conPrecio: false,
    conProveedor: false,
    // 0 a propósito: una línea entregada en cero es información, no un error.
    cantidadMinima: 0,
  },
};
