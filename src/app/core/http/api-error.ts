/** Error normalizado de la API, con el detalle que devuelve FastAPI. */
export interface AppError {
  /** Familia del error, para decidir cómo reaccionar sin mirar el status. */
  kind: 'validation' | 'notfound' | 'conflict' | 'auth' | 'server' | 'network' | 'unknown';
  message: string;
  status: number;
  cause?: unknown;
}

export function kindFromStatus(status: number): AppError['kind'] {
  if (status === 0) return 'network';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'notfound';
  if (status === 409) return 'conflict';
  if (status === 422 || status === 400) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}
