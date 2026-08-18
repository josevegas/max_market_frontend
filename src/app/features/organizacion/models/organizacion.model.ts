/** Modelos de la organización física de la cadena.
 *
 * Es una jerarquía de cuatro niveles, cada uno colgando del anterior:
 *
 *   zona → sede → market → almacén
 *
 * Los tres primeros viven acá; el almacén, en su propio módulo, porque además
 * de ubicar guarda stock. Los tres tienen exactamente los mismos campos
 * —nombre, código y su padre—, que es lo que permite una sola pantalla.
 */

import { Auditoria } from '../../productos/models/catalogo.model';

export interface Zona extends Auditoria {
  nombre: string;
  codigo: string;
}

export interface Sede extends Auditoria {
  zona_id: string;
  nombre: string;
  codigo: string;
}

export interface Market extends Auditoria {
  sede_id: string;
  nombre: string;
  codigo: string;
}

/** Lo que cualquiera de los tres expone, visto por la pantalla genérica.
 *
 * Sin índice de string a propósito: con él, `Zona` y `Sede` dejan de ser
 * asignables a este tipo y el registro de servicios no compila. El campo del
 * padre, que sí es dinámico, se lee con `campoDe()`. */
export interface Ubicacion extends Auditoria {
  nombre: string;
  codigo: string;
}

/** Lee un campo que solo se conoce en ejecución (`zona_id`, `sede_id`). */
export function campoDe(ubicacion: Ubicacion, campo: string): string | null {
  const valor = (ubicacion as unknown as Record<string, unknown>)[campo];
  return typeof valor === 'string' ? valor : null;
}
