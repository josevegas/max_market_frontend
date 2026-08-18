/** Modelos del maestro de proveedores.
 *
 * Reflejan el contrato de la API (`/api/v1`). Los campos de auditoría los pone
 * el servidor y solo llegan en las respuestas, por eso no están en los tipos
 * de creación ni de edición.
 */

/** Campos que toda respuesta arrastra. */
export interface Auditoria {
  id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}
// ---- Empresa ----
export interface Empresa extends Auditoria {
  ruc: string;
  razon_social: string;
  ubigeo_sunat: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  /** Estado de contribuyente según SUNAT ("ACTIVO", "BAJA DE OFICIO"...). */
  estado: string | null;
  es_proveedor: boolean;
  es_ag_retencion: boolean;
  es_ag_percepcion: boolean;
}

/** El alta corriente va por `desde-ruc`, que arma esto en el servidor con lo
 *  que devuelve SUNAT. Se declara completo porque el POST directo sigue
 *  existiendo y el backend exige `razon_social`, `ubigeo_sunat` y `estado`. */
export interface EmpresaCreate {
  ruc: string;
  razon_social: string;
  ubigeo_sunat: string;
  estado: string;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  es_proveedor?: boolean;
  es_ag_retencion?: boolean;
  es_ag_percepcion?: boolean;
}

export interface EmpresaUpdate {
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  es_proveedor?: boolean;
}

/** Respuesta de `GET /empresas/ruc/{ruc}`: datos de SUNAT ya normalizados y
 *  sin guardar nada.
 *
 *  Los nombres son los del `ConsultaRucResponse` del backend, que no coinciden
 *  con los de `Empresa`: acá el RUC es `numero_documento` y el ubigeo es
 *  `ubigeo`, porque son los datos crudos del proveedor de consultas, todavía
 *  sin mapear a la tabla.
 *
 *  La condición de agente **no** viaja acá: sale del padrón oficial de SUNAT
 *  (`/padron-agentes`), y el alta la resuelve el servidor. */
export interface ConsultaRuc {
  numero_documento: string;
  razon_social: string;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  ubigeo: string | null;
  estado: string | null;
  condicion: string | null;
  crudo: Record<string, unknown>;
}

// ---- Padrón de agentes ----

/** Respuesta de `GET /padron-agentes/estado`.
 *
 *  El padrón es la fuente oficial de `es_ag_retencion` y `es_ag_percepcion`:
 *  la consulta de RUC no informa esos datos. Mientras esté vacío, toda empresa
 *  nueva se registra como no agente, así que saber cuándo se sincronizó por
 *  última vez es parte de poder confiar en la ficha. */
export interface EstadoPadron {
  tiene_datos: boolean;
  agentes_retencion: number;
  agentes_percepcion: number;
  ultima_sincronizacion: string | null;
  ultima_ok: boolean | null;
  ultimo_detalle: string | null;
}

/** Respuesta de `POST /padron-agentes/sincronizar`: qué hizo la corrida. */
export interface ResumenSincronizacion {
  ok: boolean;
  filas_retencion: number;
  filas_percepcion: number;
  /** Empresas cuya condición de agente cambió al reconciliar. */
  empresas_actualizadas: number;
  detalle: string | null;
}

// ---- Productos del proveedor ----

/** Fila de `proveedor_productos`: qué empresa provee qué producto y en cuántos
 *  días lo atiende. Es lo que devuelven el PUT, el POST masivo y el DELETE. */
export interface ProveedorProducto extends Auditoria {
  empresa_id: string;
  producto_id: string;
  tiempo_atencion: number;
}

/** Fila de `GET /empresas/{id}/productos`, con el producto ya resuelto.
 *  El `id` es el de la asignación, no el del producto. Sin auditoría. */
export interface ProductoDelProveedor {
  id: string;
  producto_id: string;
  sku: string;
  descripcion_corta: string;
  tiempo_atencion: number;
}

/** Fila de `GET /productos/{id}/proveedores`, del más rápido al más lento. */
export interface ProveedorDelProducto {
  id: string;
  empresa_id: string;
  razon_social: string;
  ruc: string;
  tiempo_atencion: number;
}

/** Una línea del alta masiva. `tiempo_atencion` va en días, de 0 a 365. */
export interface AsignacionProducto {
  producto_id: string;
  tiempo_atencion: number;
}

/** Parámetros de listado que acepta la API. No hay paginación por página:
 *  el backend expone `limite`/`desplazamiento`. */
export interface ParamsListado {
  solo_activos?: boolean;
  /** El filtro que declara el router de empresas es `es_proveedor`. */
  es_proveedor?: boolean | null;
  limite?: number;
  desplazamiento?: number;
  [filtro: string]: unknown;
}