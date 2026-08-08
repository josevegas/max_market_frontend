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
export interface Empresa extends Auditoria{
    ruc: string;
    razon_social: string;
    ubigeo_sunat: string;
    direccion: string;
    telefono: string | null;
    email: string | null;
    es_proveedor: boolean;
    es_ag_retencion: boolean;
    es_ag_percepcion: boolean;
}
export interface EmpresaCreate{
    ruc:string;
    es_proveedor:boolean;
}
export interface EmpresaUpdate{
    direccion:string|null;
    telefono: string|null;
    email:string|null;
    es_proveedor:boolean;
}

/** Parámetros de listado que acepta la API. No hay paginación por página:
 *  el backend expone `limite`/`desplazamiento`. */
export interface ParamsListado {
  solo_activos?: boolean;
  solo_proveedores?:boolean;
  limite?: number;
  desplazamiento?: number;
  [filtro: string]: unknown;
}