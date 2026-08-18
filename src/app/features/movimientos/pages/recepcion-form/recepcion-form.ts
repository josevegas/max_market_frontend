import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin, of, switchMap } from 'rxjs';

import { AppError } from '../../../../core/http/api-error';
import { Almacen, UnidadMedida } from '../../../almacenes/models/almacenes.model';
import {
  AlmacenService,
  UnidadMedidaService,
} from '../../../almacenes/services/almacenes.service';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import { CODIGO_RECEPCIONADO } from '../../models/codigos-estado';
import {
  DocumentoDetalle,
  Estado,
  GuiaRemision,
  LineaRecepcion,
  OrdenCompra,
  Recepcion,
  RecepcionCreate,
  RecepcionDetalle,
} from '../../models/movimientos.model';
import {
  EstadoService,
  GuiaRemisionDetalleService,
  GuiaRemisionService,
  OrdenCompraDetalleService,
  OrdenCompraService,
  RecepcionDetalleService,
  RecepcionService,
} from '../../services/movimientos.service';

/** Contra qué papel se recibe. */
type Origen = 'guia' | 'orden';

/** Editor de una recepción: cabecera y líneas juntas.
 *
 * No reutiliza `documento-form` porque la recepción no encaja en ese molde: no
 * nace de un padre aprobado, puede colgar de la guía o de la orden, y su
 * detalle lleva tres cantidades. Lo que sí comparte es la forma de guardar
 * —cabecera primero, líneas después con su id— porque la API las expone como
 * dos recursos y para quien opera es un solo documento.
 */
@Component({
  standalone: true,
  selector: 'app-recepcion-form',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
  ],
  templateUrl: './recepcion-form.html',
})
export class RecepcionForm implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(RecepcionService);
  private readonly detalleSvc = inject(RecepcionDetalleService);
  private readonly guiaSvc = inject(GuiaRemisionService);
  private readonly guiaDetalleSvc = inject(GuiaRemisionDetalleService);
  private readonly ordenSvc = inject(OrdenCompraService);
  private readonly ordenDetalleSvc = inject(OrdenCompraDetalleService);
  private readonly estadoSvc = inject(EstadoService);
  private readonly almacenSvc = inject(AlmacenService);
  private readonly productoSvc = inject(ProductoService);
  private readonly unidadSvc = inject(UnidadMedidaService);
  private readonly msg = inject(MessageService);

  readonly origenes: { label: string; value: Origen }[] = [
    { label: 'Guía de remisión', value: 'guia' },
    { label: 'Orden de compra (entrega sin guía)', value: 'orden' },
  ];

  readonly recepcionId = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly cargandoLineas = signal(false);
  readonly guardando = signal(false);
  readonly esNuevo = computed(() => this.recepcionId() === null);

  readonly estados = signal<Estado[]>([]);
  readonly almacenes = signal<Almacen[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly unidades = signal<UnidadMedida[]>([]);
  readonly guias = signal<GuiaRemision[]>([]);
  readonly ordenes = signal<OrdenCompra[]>([]);

  // Cabecera
  origen: Origen = 'guia';
  guiaId: string | null = null;
  ordenId: string | null = null;
  almacenId: string | null = null;
  estadoId: string | null = null;
  fecha: Date = new Date();
  observaciones = '';

  readonly lineas = signal<LineaRecepcion[]>([]);
  /** Ids de líneas guardadas que el usuario quitó. Se dan de baja al guardar,
   * no al quitarlas: mientras no se confirme, salir debe dejar todo como
   * estaba. */
  private readonly lineasEliminadas = signal<string[]>([]);

  readonly nombreProducto = computed(
    () => new Map(this.productos().map((p) => [p.id, p.descripcion_corta])),
  );
  readonly nombreEstado = computed(
    () => new Map(this.estados().map((e) => [e.id, e.descripcion])),
  );

  /** Guías que todavía no se recibieron. La API rechaza con 409 recepcionar
   * dos veces la misma, así que no tiene sentido ofrecerlas. */
  readonly guiasDisponibles = computed(() => {
    const recepcionado = this.estados().find((e) => e.codigo === CODIGO_RECEPCIONADO)?.id;
    const libres = recepcionado
      ? this.guias().filter((g) => g.estado_id !== recepcionado)
      : this.guias();
    return libres.map((g) => ({ id: g.id, etiqueta: `${g.fecha} · ${g.id.slice(0, 8)}` }));
  });

  readonly ordenesLista = computed(() =>
    this.ordenes().map((o) => ({ id: o.id, etiqueta: `${o.fecha} · ${o.id.slice(0, 8)}` })),
  );

  readonly totalIngresado = computed(() =>
    this.lineas().reduce((s, l) => s + (l.cantidad_ingresada || 0), 0),
  );
  readonly totalImporte = computed(() =>
    this.lineas().reduce(
      (s, l) => s + (l.cantidad_ingresada || 0) * (l.precio_unitario || 0),
      0,
    ),
  );

  ngOnInit(): void {
    const id = this.ruta.snapshot.params['id'] as string | undefined;
    this.recepcionId.set(id ?? null);

    this.estadoSvc.listar({ limite: 200 }).subscribe({
      next: (e) => this.estados.set(e),
      error: () => this.estados.set([]),
    });
    this.almacenSvc.listarTodo().subscribe({
      next: (a) => this.almacenes.set(a),
      error: () => this.almacenes.set([]),
    });
    this.productoSvc.listarTodo().subscribe({
      next: (p) => this.productos.set(p),
      error: () => this.productos.set([]),
    });
    this.unidadSvc.listarTodo().subscribe({
      next: (u) => this.unidades.set(u),
      error: () => this.unidades.set([]),
    });
    this.guiaSvc.listarTodo().subscribe({
      next: (g) => this.guias.set(g),
      error: () => this.guias.set([]),
    });
    this.ordenSvc.listarTodo().subscribe({
      next: (o) => this.ordenes.set(o),
      error: () => this.ordenes.set([]),
    });

    if (id) this.cargar(id);
  }

  private cargar(id: string): void {
    this.cargando.set(true);
    forkJoin({
      cabecera: this.svc.obtener(id),
      detalle: this.detalleSvc.listar({ recepcion_id: id, limite: 500 }),
    }).subscribe({
      next: ({ cabecera, detalle }) => {
        this.aplicar(cabecera);
        this.lineas.set(
          (detalle as RecepcionDetalle[]).map((d) => ({
            id: d.id,
            producto_id: d.producto_id,
            unidad_medida_id: d.unidad_medida_id,
            cantidad_esperada: d.cantidad_esperada,
            cantidad_ingresada: d.cantidad_ingresada,
            cantidad_devuelta: d.cantidad_devuelta,
            precio_unitario: Number(d.precio_unitario ?? 0),
            codigo_lote: d.codigo_lote,
          })),
        );
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo cargar', detail: e.message });
      },
    });
  }

  private aplicar(r: Recepcion): void {
    this.origen = r.guia_remision_id ? 'guia' : 'orden';
    this.guiaId = r.guia_remision_id;
    this.ordenId = r.orden_compra_id;
    this.almacenId = r.almacen_id;
    this.estadoId = r.estado_id;
    this.fecha = new Date(`${r.fecha}T00:00:00`);
    this.observaciones = r.observaciones ?? '';
  }

  /** Al cambiar de guía/orden se descartan las líneas propuestas: si no,
   *  quedarían las del documento anterior con productos que este no trae. */
  alCambiarOrigen(): void {
    this.guiaId = null;
    this.ordenId = null;
    this.descartarPropuestas();
  }

  private descartarPropuestas(): void {
    this.lineas.update((ls) => ls.filter((l) => l.id));
  }

  /** Propone las líneas a partir de lo que declara el documento de origen.
   *
   * Es lo que convierte la recepción en un cotejo y no en una carga a ciegas:
   * `cantidad_esperada` es lo que el papel decía y `cantidad_ingresada` arranca
   * igual, para que el operador solo tenga que tocar lo que no cuadró.
   */
  proponerLineas(): void {
    const esGuia = this.origen === 'guia';
    const padreId = esGuia ? this.guiaId : this.ordenId;
    if (!padreId) return;

    this.cargandoLineas.set(true);
    const detalle$ = esGuia
      ? this.guiaDetalleSvc.listar({ guia_remision_id: padreId, limite: 500 })
      : this.ordenDetalleSvc.listar({ orden_compra_id: padreId, limite: 500 });

    detalle$.subscribe({
      next: (detalle: DocumentoDetalle[]) => {
        this.cargandoLineas.set(false);
        if (!detalle.length) {
          this.msg.add({
            severity: 'warn',
            summary: 'Sin líneas',
            detail: 'El documento de origen no tiene líneas que proponer.',
          });
          return;
        }
        // Las líneas ya guardadas se conservan: proponer no debe pisar lo que
        // el operador cargó a mano en una recepción que se está corrigiendo.
        const yaEstan = new Set(
          this.lineas()
            .map((l) => l.producto_id)
            .filter(Boolean),
        );
        const nuevas: LineaRecepcion[] = detalle
          .filter((d) => !yaEstan.has(d.producto_id))
          .map((d) => ({
            producto_id: d.producto_id,
            unidad_medida_id: d.unidad_medida_id,
            cantidad_esperada: d.cantidad,
            cantidad_ingresada: d.cantidad,
            cantidad_devuelta: 0,
            precio_unitario: Number(d.precio_unitario ?? 0),
            codigo_lote: null,
          }));
        this.lineas.update((ls) => [...ls, ...nuevas]);
        this.msg.add({
          severity: 'success',
          summary: `${nuevas.length} línea(s) propuestas`,
          detail: 'Ajuste lo ingresado y lo devuelto donde no haya cuadrado.',
          life: 3500,
        });
      },
      error: (e: AppError) => {
        this.cargandoLineas.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo leer el origen', detail: e.message });
      },
    });
  }

  agregarLinea(): void {
    this.lineas.update((ls) => [
      ...ls,
      {
        producto_id: null,
        unidad_medida_id: null,
        cantidad_esperada: 0,
        cantidad_ingresada: 0,
        cantidad_devuelta: 0,
        precio_unitario: 0,
        codigo_lote: null,
      },
    ]);
  }

  quitarLinea(indice: number): void {
    const linea = this.lineas()[indice];
    if (linea?.id) this.lineasEliminadas.update((ids) => [...ids, linea.id!]);
    this.lineas.update((ls) => ls.filter((_, i) => i !== indice));
  }

  get errorCabecera(): string | null {
    if (this.origen === 'guia' && !this.guiaId) return 'Seleccione la guía de remisión';
    if (this.origen === 'orden' && !this.ordenId) return 'Seleccione la orden de compra';
    if (!this.almacenId) return 'Seleccione el almacén que recibe';
    if (!this.fecha) return 'Indique la fecha';
    return null;
  }

  get errorLineas(): string | null {
    const ls = this.lineas();
    if (!ls.length) return 'Agregue al menos una línea';
    const productos = new Set<string>();
    for (const [i, l] of ls.entries()) {
      if (!l.producto_id) return `Línea ${i + 1}: falta el producto`;
      if (!l.unidad_medida_id) return `Línea ${i + 1}: falta la unidad`;
      // La API tiene un único por (recepción, producto): dos líneas del mismo
      // producto vuelven como 409 después de haber creado las anteriores.
      if (productos.has(l.producto_id)) {
        return `Línea ${i + 1}: el producto ya está en otra línea`;
      }
      productos.add(l.producto_id);
      if (l.cantidad_esperada < 0 || l.cantidad_ingresada < 0 || l.cantidad_devuelta < 0) {
        return `Línea ${i + 1}: las cantidades no pueden ser negativas`;
      }
      if (l.precio_unitario < 0) return `Línea ${i + 1}: el precio no puede ser negativo`;
    }
    return null;
  }

  get valido(): boolean {
    return !this.errorCabecera && !this.errorLineas;
  }

  /** `YYYY-MM-DD` en hora local. `toISOString()` pasa por UTC y en Perú
   * (UTC-5) devuelve el día anterior para cualquier fecha del día. */
  private aIso(fecha: Date): string {
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private cuerpoCabecera(): RecepcionCreate {
    const cuerpo: RecepcionCreate = {
      almacen_id: this.almacenId!,
      fecha: this.aIso(this.fecha),
      observaciones: this.observaciones.trim() || null,
    };
    if (this.origen === 'guia') {
      cuerpo.guia_remision_id = this.guiaId;
      // La orden se deduce de la guía en el servidor; mandarla podría cerrar
      // la cadena de una orden ajena a la guía que de verdad se recibió.
    } else {
      cuerpo.orden_compra_id = this.ordenId;
    }
    // En el alta el estado no viaja: registrar la recepción **es**
    // recepcionar, y el servidor le pone `RECEPCIONADO`. En edición sí, porque
    // ahí sirve para anularla o corregirla.
    if (!this.esNuevo() && this.estadoId) cuerpo.estado_id = this.estadoId;
    return cuerpo;
  }

  private cuerpoLinea(linea: LineaRecepcion, recepcionId: string): Record<string, unknown> {
    return {
      recepcion_id: recepcionId,
      producto_id: linea.producto_id,
      unidad_medida_id: linea.unidad_medida_id,
      cantidad_esperada: linea.cantidad_esperada,
      cantidad_ingresada: linea.cantidad_ingresada,
      cantidad_devuelta: linea.cantidad_devuelta,
      precio_unitario: linea.precio_unitario,
      codigo_lote: linea.codigo_lote?.trim() || null,
    };
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const id = this.recepcionId();
    const guardarCabecera = id
      ? this.svc.actualizar(id, this.cuerpoCabecera())
      : this.svc.crear(this.cuerpoCabecera());

    guardarCabecera
      .pipe(
        switchMap((cabecera: Recepcion) => {
          const padreId = cabecera.id;
          const peticiones = [
            ...this.lineasEliminadas().map((idLinea) => this.detalleSvc.desactivar(idLinea)),
            ...this.lineas().map((linea) =>
              linea.id
                ? this.detalleSvc.actualizar(linea.id, this.cuerpoLinea(linea, padreId))
                : this.detalleSvc.crear(this.cuerpoLinea(linea, padreId)),
            ),
          ];
          // `forkJoin` de una lista vacía no emite nunca: sin esta guarda, una
          // recepción sin cambios en el detalle dejaba el guardado colgado.
          return peticiones.length
            ? forkJoin(peticiones).pipe(switchMap(() => of(cabecera)))
            : of(cabecera);
        }),
      )
      .subscribe({
        next: (cabecera) => {
          this.guardando.set(false);
          this.msg.add({
            severity: 'success',
            summary: id ? 'Recepción actualizada' : 'Recepción registrada',
            detail: id
              ? `Se guardaron ${this.lineas().length} línea(s).`
              : 'La guía queda recepcionada y la cadena, atendida.',
            life: 4000,
          });
          // Tras el alta se queda en la ficha: el estado y el arrastre de la
          // cadena los resolvió el servidor y conviene verlos.
          if (id) this.volver();
          else this.router.navigate(['/recepciones', cabecera.id]);
        },
        error: (e: AppError) => {
          this.guardando.set(false);
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo guardar',
            detail: e.message,
          });
        },
      });
  }

  volver(): void {
    this.router.navigate(['/recepciones']);
  }
}
