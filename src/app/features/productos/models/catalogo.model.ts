/** Modelos del maestro de productos.
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

// ── Familia ─────────────────────────────────────────────────────────────────
export interface Familia extends Auditoria {
  nombre: string;
  codigo: string | null;
}
export interface FamiliaCreate {
  nombre: string;
  codigo?: string | null;
}
export type FamiliaUpdate = Partial<FamiliaCreate>;

// ── Sub familia ─────────────────────────────────────────────────────────────
export interface SubFamilia extends Auditoria {
  nombre: string;
  codigo: string | null;
  familia_id: string;
}
export interface SubFamiliaCreate {
  nombre: string;
  codigo?: string | null;
  familia_id: string;
}
export type SubFamiliaUpdate = Partial<SubFamiliaCreate>;

// ── Categoría ───────────────────────────────────────────────────────────────
export interface Categoria extends Auditoria {
  nombre: string;
  codigo: string | null;
  sub_familia_id: string;
  /** Llega como string por la precisión decimal del backend. */
  margen_ganancia: string | number;
}
export interface CategoriaCreate {
  nombre: string;
  codigo?: string | null;
  sub_familia_id: string;
  margen_ganancia: number;
}
export type CategoriaUpdate = Partial<CategoriaCreate>;

// ── Sub categoría ───────────────────────────────────────────────────────────
export interface SubCategoria extends Auditoria {
  nombre: string;
  codigo: string | null;
  categoria_id: string;
}
export interface SubCategoriaCreate {
  nombre: string;
  codigo?: string | null;
  categoria_id: string;
}
export type SubCategoriaUpdate = Partial<SubCategoriaCreate>;

// ── Presentación ────────────────────────────────────────────────────────────
export interface Presentacion extends Auditoria {
  descripcion: string;
  codigo: string | null;
}
export interface PresentacionCreate {
  descripcion: string;
  codigo?: string | null;
}
export type PresentacionUpdate = Partial<PresentacionCreate>;

// ── Producto ────────────────────────────────────────────────────────────────
export interface Producto extends Auditoria {
  tipo_producto: string;
  sku: string;
  codigo_barras: string | null;
  codigo_sunat: string|null;
  descripcion_corta: string;
  descripcion_legal: string;
  descripcion_compra: string;
  descripcion_web: string;
  familia_id: string;
  sub_familia_id: string;
  categoria_id: string;
  sub_categoria_id: string | null;
  presentacion_id: string | null;
}
export interface ProductoCreate {
  tipo_producto: string;
  sku: string;
  codigo_barras?: string | null;
  descripcion_corta: string;
  descripcion_legal: string;
  descripcion_compra: string;
  descripcion_web: string;
  familia_id: string;
  sub_familia_id: string;
  categoria_id: string;
  sub_categoria_id?: string | null;
  presentacion_id?: string | null;
}
export type ProductoUpdate = Partial<ProductoCreate>;

// ── Precio ──────────────────────────────────────────────────────────────────
export interface PrecioProducto extends Auditoria {
  producto_id: string;
  precio_compra: string | number;
  precio_venta: string | number;
  fecha_inicio: string;
  fecha_fin: string | null;
}
export interface PrecioProductoCreate {
  producto_id: string;
  precio_compra: number;
  precio_venta: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
}

/** Parámetros de listado que acepta la API. No hay paginación por página:
 *  el backend expone `limite`/`desplazamiento`. */
export interface ParamsListado {
  solo_activos?: boolean;
  limite?: number;
  desplazamiento?: number;
  [filtro: string]: unknown;
}
