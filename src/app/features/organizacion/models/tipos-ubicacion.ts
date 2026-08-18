import { ClaveUbicacion } from '../services/organizacion.service';

/** Qué distingue a cada nivel de la jerarquía.
 *
 * Zona, sede y market tienen los mismos tres campos y las mismas cinco
 * operaciones; lo único que cambia es de quién cuelgan. Con esta tabla la
 * pantalla es una sola.
 */
export interface TipoUbicacion {
  clave: ClaveUbicacion;
  titulo: string;
  singular: string;
  articulo: 'el' | 'la';
  descripcion: string;

  /** Nivel del que cuelga. `null` en la zona, que es la raíz. */
  padre: {
    campo: string;
    etiqueta: string;
    fuente: ClaveUbicacion;
  } | null;

  /** Nivel que cuelga de este, solo para explicarlo en pantalla. */
  contiene: string;
}

export const TIPOS_UBICACION: Record<ClaveUbicacion, TipoUbicacion> = {
  zonas: {
    clave: 'zonas',
    titulo: 'Zonas',
    singular: 'zona',
    articulo: 'la',
    descripcion: 'El nivel más alto: agrupa las sedes por región',
    padre: null,
    contiene: 'sedes',
  },
  sedes: {
    clave: 'sedes',
    titulo: 'Sedes',
    singular: 'sede',
    articulo: 'la',
    descripcion: 'Cada local de una zona; contiene uno o varios markets',
    padre: { campo: 'zona_id', etiqueta: 'Zona', fuente: 'zonas' },
    contiene: 'markets',
  },
  markets: {
    clave: 'markets',
    titulo: 'Markets',
    singular: 'market',
    articulo: 'el',
    descripcion: 'La tienda propiamente dicha, con sus almacenes',
    padre: { campo: 'sede_id', etiqueta: 'Sede', fuente: 'sedes' },
    contiene: 'almacenes',
  },
};
