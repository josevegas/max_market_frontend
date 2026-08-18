/** Estados con significado de negocio dentro de la cadena de compras.
 *
 * Espejo de `app/modules/movimientos/constantes.py`. `estados` es un catálogo
 * abierto —cualquiera puede dar de alta "En revisión"— pero estos cuatro sí
 * deciden si la cadena avanza, y el frontend necesita reconocerlos para no
 * ofrecer lo que el servidor va a rechazar.
 *
 * Se reconocen por `codigo` y no por `descripcion` por el mismo motivo que en
 * el backend: la descripción se edita desde la API ("Aprobado", "APROBADO",
 * "Aprobada") y con eso la regla dejaría de aplicar. El código es corto,
 * estable, y la migración que siembra las cuatro filas lo fija.
 */

/** Recién creado. No habilita el siguiente documento de la cadena. */
export const CODIGO_PENDIENTE = 'PEN';
/** Visado. Es el único estado desde el que la cadena avanza. */
export const CODIGO_APROBADO = 'APR';
/** La mercadería de la guía entró al almacén. */
export const CODIGO_RECEPCIONADO = 'REC';
/** El documento ya cumplió su función: lo que pedía llegó. */
export const CODIGO_ATENDIDO = 'ATE';
