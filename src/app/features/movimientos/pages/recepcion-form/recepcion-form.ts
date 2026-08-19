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
import { catchError, map } from 'rxjs/operators';

import { AppError } from '../../../../core/http/api-error';
import { Almacen, UnidadMedida } from '../../../almacenes/models/almacenes.model';
import {
  AlmacenService,
  UnidadMedidaService,
} from '../../../almacenes/services/almacenes.service';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import { EmpresaService } from '../../../proveedores/services/empresas.service';
import { CODIGO_APROBADO, CODIGO_RECEPCIONADO } from '../../models/codigos-estado';
import {
  Cotizacion,
  DocumentoDetalle,
  Estado,
  GuiaRemision,
  LineaRecepcion,
  OrdenCompra,
  Pedido,
  Recepcion,
  RecepcionCreate,
  RecepcionDetalle,
  Requerimiento,
} from '../../models/movimientos.model';
import {
  CotizacionService,
  EstadoService,
  GuiaRemisionDetalleService,
  GuiaRemisionService,
  OrdenCompraDetalleService,
  OrdenCompraService,
  PedidoService,
  RecepcionDetalleService,
  RecepcionService,
  RequerimientoService,
} from '../../services/movimientos.service';

/** Contra qué papel se recibe. */
type Origen = 'guia' | 'orden';

/** Lo que se sabe del documento contra el que se recibe, después de recorrer
 * la cadena hacia atrás.
 *
 * La recepción cuelga de la guía o de la orden, pero los datos que hacen falta
 * para llenar la cabecera están repartidos: el almacén vive en el
 * requerimiento —cinco documentos más atrás— y el proveedor, en la cotización.
 * Nada de esto lo trae un solo endpoint, así que se resuelve encadenando.
 */
interface OrigenResuelto {
  /** Fecha del documento elegido. */
  fecha: string;
  ordenId: string | null;
  ordenFecha: string | null;
  montoOrden: string | number | null;
  proveedor: string | null;
  /** El almacén que pidió la mercadería, del requerimiento que abrió la
   * cadena. Nulo si algún eslabón no se pudo leer. */
  almacenId: string | null;
  /** Qué eslabones se pudieron leer. Con la cadena incompleta el formulario no
   * bloquea nada: prefiere dejar decidir a inventar. */
  cadenaCompleta: boolean;
}

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
  private readonly cotizacionSvc = inject(CotizacionService);
  private readonly pedidoSvc = inject(PedidoService);
  private readonly requerimientoSvc = inject(RequerimientoService);
  private readonly empresaSvc = inject(EmpresaService);
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

  /** Lo que se leyó del documento de origen. Nulo mientras no haya uno
   * elegido, o si la cadena no se pudo recorrer. */
  readonly origenResuelto = signal<OrigenResuelto | null>(null);
  readonly resolviendoOrigen = signal(false);

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
  readonly nombreAlmacen = computed(
    () => new Map(this.almacenes().map((a) => [a.id, a.nombre])),
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

  /** Órdenes que todavía se pueden recibir: solo las aprobadas.
   *
   * `APR` es el único estado desde el que la cadena avanza. Una `ATE` ya
   * cumplió su función —la mercadería llegó y la recepción la arrastró a
   * atendida— y volver a recibirla duplicaría el stock; las pendientes,
   * observadas o rechazadas no están visadas todavía.
   *
   * Se filtra en positivo y no descartando `ATE`: los otros cuatro estados
   * tampoco habilitan recibir, y enumerarlos dejaría fuera cualquier estado
   * nuevo que el catálogo admita.
   */
  readonly ordenesDisponibles = computed(() => {
    const aprobado = this.estados().find((e) => e.codigo === CODIGO_APROBADO)?.id;
    // Sin el catálogo cargado no se puede filtrar; se ofrecen todas antes que
    // dejar el selector vacío sin explicación, igual que con las guías.
    const listas = aprobado
      ? this.ordenes().filter((o) => o.estado_id === aprobado)
      : this.ordenes();
    return listas.map((o) => ({ id: o.id, etiqueta: `${o.fecha} · ${o.id.slice(0, 8)}` }));
  });

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

    // El resumen del origen también sirve acá, para saber contra qué se
    // recibió sin ir a buscarlo a otra pantalla.
    const origenId = r.guia_remision_id ?? r.orden_compra_id;
    if (origenId) this.resolverOrigen(origenId, false);
  }

  /** Al cambiar de guía a orden se descartan las líneas propuestas: si no,
   *  quedarían las del documento anterior con productos que este no trae. */
  alCambiarOrigen(): void {
    this.guiaId = null;
    this.ordenId = null;
    this.origenResuelto.set(null);
    this.descartarPropuestas();
  }

  private descartarPropuestas(): void {
    this.lineas.update((ls) => ls.filter((l) => l.id));
  }

  /** Elegir el documento **es** cargarlo: sus líneas y los datos de su cadena
   * entran solos.
   *
   * Antes había que elegirlo y después pulsar "traer líneas", y el almacén se
   * tecleaba aparte aunque el requerimiento ya dijera cuál era. Eran dos pasos
   * para una sola decisión, y el segundo se olvidaba.
   */
  alSeleccionarDocumento(): void {
    this.descartarPropuestas();
    this.origenResuelto.set(null);
    const id = this.origen === 'guia' ? this.guiaId : this.ordenId;
    if (!id) return;
    this.resolverOrigen(id, true);
    this.proponerLineas();
  }

  /** Recorre la cadena hacia atrás hasta el requerimiento, que es donde vive
   * el almacén, juntando de paso el proveedor y el monto de la orden.
   *
   * Va encadenado y no en paralelo porque cada eslabón trae el id del
   * siguiente. Un eslabón que falla no rompe la pantalla: se devuelve lo que
   * se alcanzó a leer y los campos que no se pudieron deducir quedan
   * habilitados para llenarlos a mano.
   */
  private resolverOrigen(id: string, aplicar: boolean): void {
    this.resolviendoOrigen.set(true);

    const doc$ =
      this.origen === 'guia'
        ? this.guiaSvc
            .obtener(id)
            .pipe(map((g: GuiaRemision) => ({ fecha: g.fecha, ordenId: g.orden_compra_id })))
        : of({ fecha: null as string | null, ordenId: id });

    doc$
      .pipe(
        switchMap((doc) =>
          this.ordenSvc.obtener(doc.ordenId).pipe(
            switchMap((orden: OrdenCompra) =>
              this.cotizacionSvc.obtener(orden.cotizacion_id).pipe(
                switchMap((cotizacion: Cotizacion) =>
                  forkJoin({
                    almacenId: this.pedidoSvc.obtener(cotizacion.pedido_id).pipe(
                      switchMap((pedido: Pedido) =>
                        this.requerimientoSvc.obtener(pedido.requerimiento_id),
                      ),
                      map((req: Requerimiento) => req.almacen_id as string | null),
                      catchError(() => of(null as string | null)),
                    ),
                    // El nombre del proveedor es rótulo, no dato: si la empresa
                    // no se puede leer, el resumen muestra el resto igual.
                    proveedor: this.empresaSvc.obtener(cotizacion.proveedor_id).pipe(
                      map((e) => e.razon_social as string | null),
                      catchError(() => of(null as string | null)),
                    ),
                  }).pipe(
                    map(({ almacenId, proveedor }) => ({
                      fecha: doc.fecha ?? orden.fecha,
                      ordenId: orden.id,
                      ordenFecha: orden.fecha,
                      montoOrden: orden.monto_total,
                      proveedor,
                      almacenId,
                      cadenaCompleta: almacenId !== null,
                    })),
                  ),
                ),
              ),
            ),
          ),
        ),
      )
      .subscribe({
        next: (resuelto: OrigenResuelto) => {
          this.resolviendoOrigen.set(false);
          this.origenResuelto.set(resuelto);
          // En una recepción ya registrada el resumen se muestra pero no se
          // aplica: su almacén y su fecha son los que quedaron asentados, y
          // pisarlos con los del documento cambiaría el papel en silencio.
          if (aplicar) this.aplicarOrigen(resuelto);
        },
        error: () => {
          // La cadena no se pudo recorrer (un documento dado de baja, un
          // permiso). Las líneas se piden aparte y pueden haber llegado igual;
          // lo que se pierde es el autocompletado, no la pantalla.
          this.resolviendoOrigen.set(false);
          this.origenResuelto.set(null);
          this.msg.add({
            severity: 'warn',
            summary: 'No se pudo leer la cadena del documento',
            detail: 'Complete el almacén y la fecha a mano.',
            life: 4000,
          });
        },
      });
  }

  /** El almacén y la fecha los manda el documento, así que se escriben acá y
   * el template los deja bloqueados: elegir otro almacén dejaría el stock en
   * uno distinto del que pidió la mercadería. */
  private aplicarOrigen(origen: OrigenResuelto): void {
    if (origen.almacenId) this.almacenId = origen.almacenId;
    if (origen.fecha) this.fecha = new Date(`${origen.fecha}T00:00:00`);
  }

  /** El almacén se bloquea solo cuando la cadena lo pudo decir. Si no, sería
   * un campo obligatorio que nadie puede llenar. */
  readonly almacenBloqueado = computed(() => !!this.origenResuelto()?.almacenId);
  readonly fechaBloqueada = computed(() => !!this.origenResuelto()?.fecha);

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
            // Arranca en lo declarado para que el operador solo toque lo que
            // no cuadró; con eso, lo devuelto arranca en cero.
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

  /** Lo devuelto sale de lo aceptado: es lo que la guía declaraba menos lo que
   * se dio por bueno, sea porque no llegó o porque se rechazó.
   *
   * Se calcula y no se teclea porque es la resta de dos números que ya están
   * en la fila, y tecleada se equivocaba: al stock entra `cantidad_ingresada`
   * sola, así que un devuelto mal puesto no descuadraba el inventario pero sí
   * el reclamo al proveedor.
   */
  recalcularDevuelta(linea: LineaRecepcion): void {
    const esperada = linea.cantidad_esperada || 0;
    const ingresada = linea.cantidad_ingresada || 0;
    // Nunca negativo: aceptar más de lo declarado es un descuadre del papel,
    // no una devolución al revés. La API lo rechaza con un 409 aparte.
    linea.cantidad_devuelta = Math.max(0, esperada - ingresada);
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
