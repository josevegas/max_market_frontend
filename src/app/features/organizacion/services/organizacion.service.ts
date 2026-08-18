import { Injectable, inject } from '@angular/core';

import { RecursoService } from '../../productos/services/catalogo.service';
import { Market, Sede, Ubicacion, Zona } from '../models/organizacion.model';

/** Nivel de la jerarquía. Es también la ruta en la API y en el frontend. */
export type ClaveUbicacion = 'zonas' | 'sedes' | 'markets';

@Injectable({ providedIn: 'root' })
export class ZonaService extends RecursoService<Zona, unknown, unknown> {
  protected readonly ruta = 'zonas';
}

@Injectable({ providedIn: 'root' })
export class SedeService extends RecursoService<Sede, unknown, unknown> {
  protected readonly ruta = 'sedes';
}

@Injectable({ providedIn: 'root' })
export class MarketService extends RecursoService<Market, unknown, unknown> {
  protected readonly ruta = 'markets';
}

/** Resuelve el servicio de cada nivel.
 *
 * La pantalla genérica recibe el nivel por la ruta, no en tiempo de
 * compilación, así que necesita elegirlo en ejecución (mismo motivo que
 * `RegistroDocumentos` en movimientos).
 */
@Injectable({ providedIn: 'root' })
export class RegistroUbicaciones {
  private readonly servicios: Record<
    ClaveUbicacion,
    RecursoService<Ubicacion, unknown, unknown>
  > = {
    zonas: inject(ZonaService),
    sedes: inject(SedeService),
    markets: inject(MarketService),
  };

  servicio(clave: ClaveUbicacion): RecursoService<Ubicacion, unknown, unknown> {
    return this.servicios[clave];
  }
}
