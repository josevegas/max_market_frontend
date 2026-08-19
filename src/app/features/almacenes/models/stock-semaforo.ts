/** El semáforo del stock de un producto en un almacén.
 *
 * Vive aparte de las pantallas porque lo miran dos: la lista de stock por
 * almacén y el detalle que se abre desde ella. Teniéndolo duplicado, un lote
 * inmovilizado se pintaba de un color en la fila y de otro en el detalle sin
 * que nada lo delatara.
 */

import { ProductoAlmacen, StockDeProducto } from './almacenes.model';

export type SeveridadStock = 'success' | 'warn' | 'danger';

/** Si la ficha y los lotes están en unidades distintas, los dos números no se
 * pueden comparar a ojo. El semáforo sigue siendo válido —lo calcula el
 * servidor en unidad mínima— pero conviene avisarlo. */
export function unidadesDistintas(
  ficha: ProductoAlmacen,
  stock: StockDeProducto | null,
): boolean {
  if (!stock) return false;
  return stock.unidad_venta_id !== ficha.unidad_medida_id;
}

/** Rojo bajo el mínimo, ámbar sobre el techo, verde en rango.
 *
 * `bajo_minimo` lo decide el servidor comparando en unidad mínima; el techo se
 * mira acá porque la respuesta no lo resuelve y solo aplica cuando la ficha y
 * los lotes comparten unidad.
 */
export function severidadStock(
  ficha: ProductoAlmacen,
  stock: StockDeProducto | null,
): SeveridadStock {
  // Sin lotes hay cero, y cero solo es alarma si la ficha pide algo. El cero no
  // necesita conversión de unidad para compararse.
  if (!stock) return ficha.stock_minimo > 0 ? 'danger' : 'success';
  if (stock.bajo_minimo) return 'danger';
  if (
    stock.stock_maximo != null &&
    !unidadesDistintas(ficha, stock) &&
    stock.disponible > stock.stock_maximo
  ) {
    return 'warn';
  }
  return 'success';
}

/** El color del número, según el semáforo. */
export function claseStock(
  ficha: ProductoAlmacen,
  stock: StockDeProducto | null,
): string {
  const severidad = severidadStock(ficha, stock);
  if (severidad === 'danger') return 'text-red-600 dark:text-red-400';
  if (severidad === 'warn') return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-700 dark:text-slate-200';
}
