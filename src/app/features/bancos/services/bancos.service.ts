import { Injectable } from '@angular/core';

import { RecursoService } from '../../productos/services/catalogo.service';
import {
  Banco,
  BancoCreate,
  BancoUpdate,
  Cuenta,
  CuentaCreate,
  CuentaUpdate,
  TipoCuenta,
  TipoCuentaCreate,
  TipoCuentaUpdate,
} from '../models/bancos.model';

/** Los tres recursos exponen los mismos cinco endpoints que el resto del
 * maestro, así que reutilizan `RecursoService` y solo declaran su ruta. */

@Injectable({ providedIn: 'root' })
export class BancoService extends RecursoService<Banco, BancoCreate, BancoUpdate> {
  protected readonly ruta = 'bancos';
}

@Injectable({ providedIn: 'root' })
export class TipoCuentaService extends RecursoService<
  TipoCuenta,
  TipoCuentaCreate,
  TipoCuentaUpdate
> {
  protected readonly ruta = 'tipos-cuenta';
}

@Injectable({ providedIn: 'root' })
export class CuentaService extends RecursoService<Cuenta, CuentaCreate, CuentaUpdate> {
  protected readonly ruta = 'cuentas';
}

/** El maestro de empresas vive en `proveedores`, que es donde se administra.
 * Acá solo se reexporta para el selector de la cuenta, y así no hay dos
 * servicios apuntando a la misma ruta. */
export { EmpresaService } from '../../proveedores/services/empresas.service';
