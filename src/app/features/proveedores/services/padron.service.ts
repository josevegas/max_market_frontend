import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import { EstadoPadron, ResumenSincronizacion } from '../models/catalogo.model';

/** Padrón oficial de agentes de retención y percepción.
 *
 * No es un CRUD —no se dan de alta agentes a mano—, así que no hereda de
 * `RecursoService`: son dos operaciones y ya. La corrida periódica la dispara
 * un job del servidor; acá se puede forzar a mano y sembrarlo la primera vez.
 */
@Injectable({ providedIn: 'root' })
export class PadronService {
  private readonly api = inject(ApiClient);
  private readonly ruta = 'padron-agentes';

  estado(): Observable<EstadoPadron> {
    return this.api.get<EstadoPadron>(`${this.ruta}/estado`);
  }

  /** Tarda unos segundos: son dos descargas contra SUNAT. */
  sincronizar(): Observable<ResumenSincronizacion> {
    return this.api.post<ResumenSincronizacion>(`${this.ruta}/sincronizar`, null);
  }
}
