import { Injectable, inject } from '@angular/core';

import { RecursoService } from '../../productos/services/catalogo.service';
import {
  Cotizacion,
  DocumentoCabecera,
  DocumentoDetalle,
  Estado,
  EstadoCreate,
  EstadoUpdate,
  GuiaRemision,
  OrdenCompra,
  Pedido,
  Recepcion,
  RecepcionCreate,
  RecepcionDetalle,
  RecepcionUpdate,
  Requerimiento,
} from '../models/movimientos.model';

/** Clave de cada documento. Es también su ruta en la API y en el frontend, así
 * que sirve de identificador único en toda la pantalla genérica. */
export type ClaveDocumento =
  | 'requerimientos'
  | 'pedidos'
  | 'cotizaciones'
  | 'ordenes-compra'
  | 'guias-remision';

// ── Maestro de estados ──────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class EstadoService extends RecursoService<Estado, EstadoCreate, EstadoUpdate> {
  protected readonly ruta = 'estados';
}

// ── Cabeceras ───────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class RequerimientoService extends RecursoService<Requerimiento, unknown, unknown> {
  protected readonly ruta = 'requerimientos';
}

@Injectable({ providedIn: 'root' })
export class PedidoService extends RecursoService<Pedido, unknown, unknown> {
  protected readonly ruta = 'pedidos';
}

@Injectable({ providedIn: 'root' })
export class CotizacionService extends RecursoService<Cotizacion, unknown, unknown> {
  protected readonly ruta = 'cotizaciones';
}

@Injectable({ providedIn: 'root' })
export class OrdenCompraService extends RecursoService<OrdenCompra, unknown, unknown> {
  protected readonly ruta = 'ordenes-compra';
}

@Injectable({ providedIn: 'root' })
export class GuiaRemisionService extends RecursoService<GuiaRemision, unknown, unknown> {
  protected readonly ruta = 'guias-remision';
}

// ── Detalles ────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class RequerimientoDetalleService extends RecursoService<
  DocumentoDetalle,
  unknown,
  unknown
> {
  protected readonly ruta = 'requerimientos-detalle';
}

@Injectable({ providedIn: 'root' })
export class PedidoDetalleService extends RecursoService<DocumentoDetalle, unknown, unknown> {
  protected readonly ruta = 'pedidos-detalle';
}

@Injectable({ providedIn: 'root' })
export class CotizacionDetalleService extends RecursoService<
  DocumentoDetalle,
  unknown,
  unknown
> {
  protected readonly ruta = 'cotizaciones-detalle';
}

@Injectable({ providedIn: 'root' })
export class OrdenCompraDetalleService extends RecursoService<
  DocumentoDetalle,
  unknown,
  unknown
> {
  protected readonly ruta = 'ordenes-compra-detalle';
}

@Injectable({ providedIn: 'root' })
export class GuiaRemisionDetalleService extends RecursoService<
  DocumentoDetalle,
  unknown,
  unknown
> {
  protected readonly ruta = 'guias-remision-detalle';
}

// ── Recepción ───────────────────────────────────────────────────────────────
/** Fuera del registro genérico a propósito: la recepción no comparte la forma
 * de los otros cinco documentos (ver `Recepcion` en el modelo). */
@Injectable({ providedIn: 'root' })
export class RecepcionService extends RecursoService<
  Recepcion,
  RecepcionCreate,
  RecepcionUpdate
> {
  protected readonly ruta = 'recepciones';
}

@Injectable({ providedIn: 'root' })
export class RecepcionDetalleService extends RecursoService<
  RecepcionDetalle,
  unknown,
  unknown
> {
  protected readonly ruta = 'recepciones-detalle';
}

// ── Proveedores (para el selector de la cotización) ─────────────────────────
/** El maestro de empresas vive en `proveedores`, que es donde se administra.
 * Acá solo se reexporta para el selector de la cotización, y así no hay dos
 * servicios apuntando a la misma ruta. */
export { EmpresaService } from '../../proveedores/services/empresas.service';

/** Resuelve qué servicio corresponde a cada documento.
 *
 * La pantalla genérica recibe la clave por la ruta, no en tiempo de
 * compilación, así que necesita elegir el servicio en ejecución. Sin este
 * registro habría que duplicar la pantalla cinco veces solo para inyectar el
 * servicio correcto.
 */
@Injectable({ providedIn: 'root' })
export class RegistroDocumentos {
  private readonly cabeceras: Record<
    ClaveDocumento,
    RecursoService<DocumentoCabecera, unknown, unknown>
  > = {
    requerimientos: inject(RequerimientoService) as never,
    pedidos: inject(PedidoService) as never,
    cotizaciones: inject(CotizacionService) as never,
    'ordenes-compra': inject(OrdenCompraService) as never,
    'guias-remision': inject(GuiaRemisionService) as never,
  };

  private readonly detalles: Record<
    ClaveDocumento,
    RecursoService<DocumentoDetalle, unknown, unknown>
  > = {
    requerimientos: inject(RequerimientoDetalleService),
    pedidos: inject(PedidoDetalleService),
    cotizaciones: inject(CotizacionDetalleService),
    'ordenes-compra': inject(OrdenCompraDetalleService),
    'guias-remision': inject(GuiaRemisionDetalleService),
  };

  cabecera(clave: ClaveDocumento): RecursoService<DocumentoCabecera, unknown, unknown> {
    return this.cabeceras[clave];
  }

  detalle(clave: ClaveDocumento): RecursoService<DocumentoDetalle, unknown, unknown> {
    return this.detalles[clave];
  }
}
