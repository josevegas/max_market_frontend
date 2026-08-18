/** Modelos del módulo de bancos.
 *
 * Son tres maestros que se apoyan uno en otro:
 *
 *   banco + tipo de cuenta + empresa → cuenta bancaria
 *
 * El banco y el tipo de cuenta son catálogos sueltos; la cuenta es la que los
 * junta y dice a qué empresa pertenece. Reflejan el contrato de `/api/v1`.
 */

import { Auditoria } from '../../productos/models/catalogo.model';

/** Monedas que admite la API. Es una lista cerrada a propósito: como texto
 * libre acabarían conviviendo "PEN", "pen", "S/" y "soles" como cuatro valores
 * distintos que después nadie puede agrupar. */
export type Moneda = 'PEN' | 'USD';

export const MONEDAS: { label: string; value: Moneda }[] = [
  { label: 'Soles (PEN)', value: 'PEN' },
  { label: 'Dólares (USD)', value: 'USD' },
];

// ── Banco ───────────────────────────────────────────────────────────────────
/** El banco es una entidad con RUC, no un simple nombre: es quien emite los
 * estados de cuenta y aparece en la documentación de pago. */
export interface Banco extends Auditoria {
  razon_social: string;
  ruc: string;
  direccion: string | null;
  telefono: string | null;
  codigo: string | null;
}
export interface BancoCreate {
  razon_social: string;
  ruc: string;
  direccion?: string | null;
  telefono?: string | null;
  codigo?: string | null;
}
export type BancoUpdate = Partial<BancoCreate>;

// ── Tipo de cuenta ──────────────────────────────────────────────────────────
/** Corriente, ahorros, detracciones... Acá el código es obligatorio, igual que
 * la descripción: la API los declara `min_length=1`. */
export interface TipoCuenta extends Auditoria {
  descripcion: string;
  codigo: string;
}
export interface TipoCuentaCreate {
  descripcion: string;
  codigo: string;
}
export type TipoCuentaUpdate = Partial<TipoCuentaCreate>;

// ── Cuenta bancaria ─────────────────────────────────────────────────────────
export interface Cuenta extends Auditoria {
  numero_cuenta: string;
  banco_id: string;
  empresa_id: string;
  tipo_cuenta_id: string;
  /** Llega como texto suelto aunque el alta solo admita `Moneda`: los
   * registros viejos podrían traer otra cosa. */
  moneda: string;
}
export interface CuentaCreate {
  numero_cuenta: string;
  banco_id: string;
  empresa_id: string;
  tipo_cuenta_id: string;
  moneda: Moneda;
}
export type CuentaUpdate = Partial<CuentaCreate>;

/** Un RUC peruano son 11 dígitos; la API rechaza cualquier otra cosa. */
export const LARGO_RUC = 11;
