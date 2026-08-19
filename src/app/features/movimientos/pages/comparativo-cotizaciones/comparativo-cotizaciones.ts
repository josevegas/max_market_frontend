import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AppError } from '../../../../core/http/api-error';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import {
  CODIGO_APROBADO,
  CODIGO_OBSERVADO,
  CODIGO_RECHAZADO,
} from '../../models/codigos-estado';
import {
  ClaveCriterio,
  Comparativo,
  CotizacionEvaluada,
  CRITERIOS,
  Estado,
} from '../../models/movimientos.model';
import {
  ComparativoService,
  CotizacionService,
  EstadoService,
} from '../../services/movimientos.service';

/** Cuadro comparativo de las cotizaciones de un pedido, para decidir cuál aprobar.
 *
 * Un pedido genera una cotización por proveedor, y cada una cotiza solo lo que su
 * proveedor distribuye. Aprobar una mirando su propio formulario es decidir sin
 * ver las alternativas; esta pantalla las pone lado a lado con los cuatro
 * criterios pesados y marca la de mayor puntaje.
 *
 * El óptimo es una **sugerencia**: los cuatro criterios no saben de una relación
 * con el proveedor, de una urgencia, ni de un acuerdo marco. Por eso se puede
 * aprobar cualquiera de las filas y no solo la marcada.
 *
 * Todo el cálculo vive en la API (`comparativo_service.py`). Acá no se repite ni
 * un peso ni una fórmula: si el negocio cambia los porcentajes, esta pantalla los
 * muestra distintos sin tocarla.
 */
@Component({
  standalone: true,
  selector: 'app-comparativo-cotizaciones',
  imports: [
    CommonModule,
    ButtonModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './comparativo-cotizaciones.html',
})
export class ComparativoCotizaciones implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(ComparativoService);
  private readonly cotizaciones = inject(CotizacionService);
  private readonly estados = inject(EstadoService);
  private readonly productos = inject(ProductoService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly criterios = CRITERIOS;

  readonly cargando = signal(false);
  readonly aprobando = signal<string | null>(null);
  readonly datos = signal<Comparativo | null>(null);
  readonly error = signal<string | null>(null);
  private readonly estadosLista = signal<Estado[]>([]);
  private readonly productosLista = signal<Producto[]>([]);

  readonly nombreProducto = computed(
    () => new Map(this.productosLista().map((p) => [p.id, p.descripcion_corta])),
  );

  /** Id del estado `APR`, o `null` si el catálogo no lo tiene. Sin él no se
   * puede aprobar, y el botón se deshabilita en vez de fallar contra la API. */
  private readonly idAprobado = computed(
    () => this.estadosLista().find((e) => e.codigo === CODIGO_APROBADO)?.id ?? null,
  );

  readonly hayCotizaciones = computed(
    () => (this.datos()?.cotizaciones.length ?? 0) > 0,
  );

  /** Con una sola cotización no hay comparación posible. Se muestra igual —el
   * puntaje y la cobertura siguen informando— pero se dice, para que nadie lea
   * "óptimo" como si le hubiera ganado a algo. */
  readonly unaSola = computed(() => this.datos()?.cotizaciones.length === 1);

  ngOnInit(): void {
    // La ruta trae `pedidoId`; el requerimiento no se usa acá porque quien llega
    // viene desde una cotización, y la cotización sabe de qué pedido cuelga.
    const pedidoId = this.ruta.snapshot.params['pedidoId'] as string;
    this.cargar(pedidoId);

    this.estados.listar({ limite: 200 }).subscribe({
      next: (e) => this.estadosLista.set(e),
      error: () => this.estadosLista.set([]),
    });
    // Para nombrar los productos que a una cotización le faltan por cotizar: la
    // API los devuelve por id, que no le dice nada a quien compra.
    this.productos.listarTodo().subscribe({
      next: (p) => this.productosLista.set(p),
      error: () => this.productosLista.set([]),
    });
  }

  private cargar(pedidoId: string): void {
    this.cargando.set(true);
    this.error.set(null);
    this.svc.dePedido(pedidoId).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        // El error va en la pantalla y no en un toast: sin datos no hay nada
        // detrás que mirar, y un toast se va solo dejando el cuadro vacío sin
        // explicación.
        this.error.set(e.message);
        this.cargando.set(false);
      },
    });
  }

  // ── Lectura de la matriz ──────────────────────────────────────────────────

  /** El peso de un criterio, como lo devolvió la API. */
  peso(clave: ClaveCriterio): number {
    return this.datos()?.pesos[clave] ?? 0;
  }

  /** El valor crudo de un criterio, ya formateado con su unidad.
   *
   * Se muestra junto al puntaje porque es el número que quien compra reconoce
   * del documento; el puntaje solo dice cómo quedó contra las demás.
   */
  valor(fila: CotizacionEvaluada, clave: ClaveCriterio): string {
    const criterio = fila.criterios[clave];
    if (criterio?.valor === null || criterio?.valor === undefined) return '—';
    const numero = Number(criterio.valor);
    if (clave === 'precio') return numero.toFixed(2);
    if (clave === 'stock') return `${numero.toFixed(0)}%`;
    return `${numero.toFixed(0)} d`;
  }

  puntaje(fila: CotizacionEvaluada, clave: ClaveCriterio): number {
    return Number(fila.criterios[clave]?.puntaje ?? 0);
  }

  aporte(fila: CotizacionEvaluada, clave: ClaveCriterio): number {
    return Number(fila.criterios[clave]?.aporte ?? 0);
  }

  /** Verde arriba de 80, ámbar de 50 a 80, rojo debajo.
   *
   * Los cortes son de lectura, no de negocio: el puntaje ya es comparable entre
   * filas y el color solo ayuda a barrer la matriz con la vista.
   */
  clasePuntaje(puntaje: number): string {
    if (puntaje >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (puntaje >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  /** Ancho de la barrita del puntaje, en porcentaje. */
  ancho(puntaje: number): string {
    return `${Math.max(0, Math.min(100, puntaje))}%`;
  }

  /** Los productos que esta cotización no cotiza, por nombre. */
  faltantes(fila: CotizacionEvaluada): string {
    const nombres = this.nombreProducto();
    return fila.productos_sin_cotizar
      .map((id) => nombres.get(id) ?? id.slice(0, 8))
      .join(', ');
  }

  yaAprobada(fila: CotizacionEvaluada): boolean {
    return fila.estado_id === this.idAprobado();
  }

  /** `codigo` del estado de la fila, o `null` si el catálogo todavía no cargó.
   *
   * Se resuelve por id contra el catálogo y no se usa la `descripcion` que trae
   * la respuesta: la descripción se edita desde la API ("Aprobado", "APROBADO",
   * "Aprobada") y colorear por texto dejaría de funcionar sin que nadie tocase
   * una línea. Es la misma regla que sigue el backend.
   */
  private codigoEstado(fila: CotizacionEvaluada): string | null {
    return this.estadosLista().find((e) => e.id === fila.estado_id)?.codigo ?? null;
  }

  /** Cada estado con su color, para que el cuadro se lea de un vistazo.
   *
   * Antes iban todos en `info` y aprobada, rechazada y pendiente se veían
   * igual, que es justo lo que hay que distinguir cuando aprobar una rechaza a
   * las demás.
   */
  severidadEstado(fila: CotizacionEvaluada): 'success' | 'danger' | 'warn' | 'info' {
    switch (this.codigoEstado(fila)) {
      case CODIGO_APROBADO:
        return 'success';
      case CODIGO_RECHAZADO:
        return 'danger';
      case CODIGO_OBSERVADO:
        return 'warn';
      default:
        // `PEN` y cualquier otro estado del catálogo abierto: es información,
        // no una alarma ni un logro.
        return 'info';
    }
  }

  /** Si esta cotización quedó descartada. */
  rechazada(fila: CotizacionEvaluada): boolean {
    return this.codigoEstado(fila) === CODIGO_RECHAZADO;
  }

  /** Las descartadas se atenúan: siguen a la vista —son el registro de contra
   * qué se eligió— pero no compiten por la atención con las que sí importan. */
  claseFila(fila: CotizacionEvaluada): string {
    if (fila.optimo) return 'bg-emerald-50/60 dark:bg-emerald-950/20';
    if (this.rechazada(fila)) return 'opacity-60';
    return '';
  }

  /** Cuántas cotizaciones hay y cuántas siguen en carrera. Va en el encabezado
   * porque "3 cotizaciones, 1 en carrera" explica de entrada por qué el resto
   * aparece atenuado. */
  readonly resumen = computed(() => {
    const filas = this.datos()?.cotizaciones ?? [];
    return { total: filas.length, enCarrera: filas.filter((f) => !this.rechazada(f)).length };
  });

  // ── Aprobar ───────────────────────────────────────────────────────────────

  /** Aprueba la cotización elegida, sea la óptima o no.
   *
   * Se confirma antes porque aprobar no es reversible en sus efectos: el
   * servidor emite la orden de compra del proveedor en el mismo movimiento. Y
   * cuando la elegida no es la óptima se dice en el mensaje, para que quede
   * claro que se está apartando de lo que el cuadro sugiere.
   */
  aprobar(fila: CotizacionEvaluada): void {
    const destino = this.idAprobado();
    if (!destino || this.aprobando()) return;

    const advertencia = fila.optimo
      ? ''
      : ' No es la de mayor puntaje: el óptimo es una sugerencia, pero conviene' +
        ' que la diferencia esté justificada.';

    this.confirm.confirm({
      header: 'Aprobar cotización',
      message:
        `Se aprobará la cotización de ${fila.proveedor} y se emitirá su orden ` +
        `de compra.${advertencia}`,
      acceptLabel: 'Aprobar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.aprobando.set(fila.cotizacion_id);
        this.cotizaciones
          .actualizar(fila.cotizacion_id, { estado_id: destino })
          .subscribe({
            next: () => {
              this.aprobando.set(null);
              this.msg.add({
                severity: 'success',
                summary: 'Cotización aprobada',
                detail: `Se aprobó la de ${fila.proveedor} y se emitió su orden de compra.`,
                life: 4000,
              });
              // Se recarga en vez de navegar: el cuadro sigue siendo útil —muestra
              // cuál quedó aprobada y contra qué se la eligió— y quien compra
              // suele querer verlo después de decidir.
              const pedido = this.datos()?.pedido_id;
              if (pedido) this.cargar(pedido);
            },
            error: (e: AppError) => {
              this.aprobando.set(null);
              this.msg.add({
                severity: 'error',
                summary: 'No se pudo aprobar',
                detail: e.message,
              });
            },
          });
      },
    });
  }

  verCotizacion(fila: CotizacionEvaluada): void {
    this.router.navigate(['/cotizaciones', fila.cotizacion_id]);
  }

  volver(): void {
    this.router.navigate(['/cotizaciones']);
  }
}
