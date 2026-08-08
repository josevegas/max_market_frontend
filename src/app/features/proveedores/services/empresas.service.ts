import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ConsultaRuc,
  Empresa,
  EmpresaCreate,
  EmpresaUpdate,
} from '../models/catalogo.model';
import { RecursoService } from '../../productos/services/catalogo.service';

@Injectable({ providedIn: 'root' })
export class EmpresaService extends RecursoService<Empresa, EmpresaCreate, EmpresaUpdate> {
  protected readonly ruta = 'empresas';

  /** Consulta el RUC en SUNAT sin guardar nada: sirve para precargar el alta. */
  consultarRuc(ruc: string): Observable<ConsultaRuc> {
    return this.api.get<ConsultaRuc>(`${this.ruta}/ruc/${ruc}`);
  }

  /** Alta con los datos que devuelve SUNAT. El cuerpo va vacío: el RUC viaja
   *  en la ruta y `es_proveedor` como query param. */
  crearDesdeRuc(ruc: string, esProveedor: boolean): Observable<Empresa> {
    return this.api.post<Empresa>(`${this.ruta}/desde-ruc/${ruc}`, null, {
      params: { es_proveedor: esProveedor },
    });
  }
}
