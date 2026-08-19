/** Estados con significado de negocio dentro de la cadena de compras.
 *
 * Espejo de `app/modules/movimientos/constantes.py`. `estados` es un catálogo
 * abierto —cualquiera puede dar de alta "En revisión"— pero estos seis sí
 * deciden si la cadena avanza, y el frontend necesita reconocerlos para no
 * ofrecer lo que el servidor va a rechazar.
 *
 * Se reconocen por `codigo` y no por `descripcion` por el mismo motivo que en
 * el backend: la descripción se edita desde la API ("Aprobado", "APROBADO",
 * "Aprobada") y con eso la regla dejaría de aplicar. El código es corto,
 * estable, y la migración que siembra esas filas lo fija.
 */

/** Recién creado. No habilita el siguiente documento de la cadena. */
export const CODIGO_PENDIENTE = 'PEN';
/** Visado. Es el único estado desde el que la cadena avanza. */
export const CODIGO_APROBADO = 'APR';
/** Devuelto a quien lo emitió: le falta algo, pero puede corregirse y volver a
 * presentarse. No habilita el siguiente documento. */
export const CODIGO_OBSERVADO = 'OBS';
/** Denegado. A diferencia de `OBS`, no se espera que vuelva. */
export const CODIGO_RECHAZADO = 'RCH';
/** La mercadería de la guía entró al almacén. */
export const CODIGO_RECEPCIONADO = 'REC';
/** El documento ya cumplió su función: lo que pedía llegó. */
export const CODIGO_ATENDIDO = 'ATE';
