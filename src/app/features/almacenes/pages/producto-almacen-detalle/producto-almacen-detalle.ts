import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { forkJoin } from 'rxjs';

import { AppError } from '../../../../core/http/api-error';
import { GuiaRemision } from '../../../movimientos/models/movimientos.model';
import { GuiaRemisionService } from '../../../movimientos/services/movimientos.service';
import {
  Categoria,
  Familia,
  Presentacion,
  Producto,
  SubCategoria,
  SubFamilia,
} from '../../../productos/models/catalogo.model';
import {
  CategoriaService,
  FamiliaService,
  PresentacionService,
  SubCategoriaService,
  SubFamiliaService,
} from '../../../productos/services/productos.service';
import {
  Almacen,
  ESTADOS_EXISTENCIA,
  EstadoExistencia,
  ProductoAlmacen,
  ProductoLote,
  StockDeProducto,
  UnidadMedida,
} from '../../models/almacenes.model';
import { claseStock, severidadStock, unidadesDistintas } from '../../models/stock-semaforo';
import { ProductoAlmacenService, ProductoLoteService } from '../../services/almacenes.service';

/** Los tipos que admite el modelo (`tipo_producto`). Mismo vocabulario que la
 * ficha del producto, para que un `insumo` no se lea distinto acá. */
const TIPOS: Record<string, string> = {
  terminado: 'Producto terminado',
  insumo: 'Insumo',
  elaborado: 'Producto elaborado',
};

/** El producto en un almacén concreto: qué es, cuánto hay y en qué lotes.
 *
 * Se abre desde la lista de stock por almacén, que es de donde saca su
 * pregunta: no "qué es este producto" —eso está en su ficha del maestro— sino
 * "qué es y cuánto hay de él acá". Por eso el disponible, el mínimo y los
 * lotes van todos acotados al almacén de la fila.
 *
 * Se edita acá mismo, en dos alcances distintos que por eso guardan por
 * separado: la **ficha del almacén** (mínimo, techo, precio de tienda) es lo
 * propio de este almacén, y cada **lote** es una pila física. Los datos del
 * producto en sí son del maestro —los mismos para todos los almacenes— así
 * que se muestran de solo lectura, con un enlace a su ficha.
 */
@Component({
  standalone: true,
  selector: 'app-producto-almacen-detalle',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TabsModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './producto-almacen-detalle.html',
})
export class ProductoAlmacenDetalle {
  private readonly loteSvc = inject(ProductoLoteService);
  private readonly fichaSvc = inject(ProductoAlmacenService);
  private readonly guiaSvc = inject(GuiaRemisionService);
  private readonly familiaSvc = inject(FamiliaService);
  private readonly subFamiliaSvc = inject(SubFamiliaService);
  private readonly categoriaSvc = inject(CategoriaService);
  private readonly subCategoriaSvc = inject(SubCategoriaService);
  private readonly presentacionSvc = inject(PresentacionService);
  private readonly msg = inject(MessageService);

  readonly estados = ESTADOS_EXISTENCIA;

  /** La fila que se abrió. Nula con el diálogo cerrado: es lo que lo gobierna,
   * así el padre no tiene que llevar un booleano en paralelo que se le
   * desincronice. */
  readonly ficha = input<ProductoAlmacen | null>(null);
  readonly producto = input<Producto | null>(null);
  readonly almacen = input<Almacen | null>(null);
  /** Lo que la lista ya calculó para esta fila. Se recibe en vez de volver a
   * pedirlo: el endpoint devuelve el almacén entero y acá interesa una fila. */
  readonly stock = input<StockDeProducto | null>(null);
  readonly unidades = input<UnidadMedida[]>([]);

  @Output() cerrar = new EventEmitter<void>();
  /** La ficha, tal como quedó guardada. El padre la necesita para refrescar su
   * lista y para que el diálogo siga mostrando lo que acaba de escribirse. */
  @Output() guardado = new EventEmitter<ProductoAlmacen>();
  /** Un lote cambió: cambia el disponible, y eso lo calcula el servidor. */
  @Output() lotesCambiados = new EventEmitter<void>();

  readonly lotes = signal<ProductoLote[]>([]);
  readonly cargandoLotes = signal(false);

  // Catálogos que solo hacen falta acá. Se piden una sola vez, la primera vez
  // que se abre el diálogo: son listas cortas que la lista de stock no
  // necesita y no vale la pena cargar con la pantalla.
  private readonly catalogosPedidos = signal(false);
  readonly cargandoCatalogos = signal(false);
  private readonly familias = signal<Familia[]>([]);
  private readonly subFamilias = signal<SubFamilia[]>([]);
  private readonly categorias = signal<Categoria[]>([]);
  private readonly subCategorias = signal<SubCategoria[]>([]);
  private readonly presentaciones = signal<Presentacion[]>([]);
  private readonly guias = signal<GuiaRemision[]>([]);

  /** Qué par almacén|producto tiene cargado en `lotes`.
   *
   * Es un campo y no una señal a propósito: guardar la ficha reemplaza el
   * objeto de `ficha()` y volvería a disparar el efecto, que sin esta guarda
   * pediría los lotes de nuevo por un cambio que no los toca.
   */
  private claveCargada: string | null = null;

  constructor() {
    effect(() => {
      const ficha = this.ficha();
      // La carga va en `untracked`: lee banderas que después escribe, y sin
      // aislarla el efecto se volvería a disparar solo.
      untracked(() => {
        if (!ficha) {
          // Al cerrar se vacía: si no, la próxima apertura muestra los lotes
          // del producto anterior hasta que llegue la respuesta.
          this.lotes.set([]);
          this.claveCargada = null;
          this.loteEnEdicion.set(null);
          return;
        }
        const clave = `${ficha.almacen_id}|${ficha.producto_id}`;
        if (clave !== this.claveCargada) {
          this.claveCargada = clave;
          this.loteEnEdicion.set(null);
          this.cargarLotes(ficha);
        }
        this.llenarFormularioFicha(ficha);
        this.cargarCatalogos();
      });
    });
  }

  readonly abierto = computed(() => this.ficha() !== null);

  /** Los lotes de este producto en este almacén, del que vence antes al que
   * vence después: lo primero que hay que mirar es qué se va a echar a perder.
   *
   * El filtro `almacen_id` lo resuelve la API; sin él habría que traer los
   * lotes de todos los almacenes para descartarlos acá.
   */
  private cargarLotes(ficha: ProductoAlmacen): void {
    this.cargandoLotes.set(true);
    this.loteSvc
      .listarTodo({ producto_id: ficha.producto_id, almacen_id: ficha.almacen_id })
      .subscribe({
        next: (lotes) => {
          this.lotes.set(this.ordenados(lotes));
          this.cargandoLotes.set(false);
        },
        error: () => {
          this.lotes.set([]);
          this.cargandoLotes.set(false);
        },
      });
  }

  /** Del que vence antes al que vence después. Los que no vencen van al final:
   * no compiten por atención con los que sí, y entre ellos manda el más viejo,
   * que es el primero que debería salir. */
  private ordenados(lotes: ProductoLote[]): ProductoLote[] {
    return [...lotes].sort((a, b) => {
      if (!a.fecha_vencimiento && !b.fecha_vencimiento) {
        return a.fecha_ingreso.localeCompare(b.fecha_ingreso);
      }
      if (!a.fecha_vencimiento) return 1;
      if (!b.fecha_vencimiento) return -1;
      return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
    });
  }

  private cargarCatalogos(): void {
    if (this.catalogosPedidos()) return;
    this.catalogosPedidos.set(true);
    this.cargandoCatalogos.set(true);
    forkJoin({
      familias: this.familiaSvc.listarTodo(),
      subFamilias: this.subFamiliaSvc.listarTodo(),
      categorias: this.categoriaSvc.listarTodo(),
      subCategorias: this.subCategoriaSvc.listarTodo(),
      presentaciones: this.presentacionSvc.listarTodo(),
      guias: this.guiaSvc.listarTodo(),
    }).subscribe({
      next: (r) => {
        this.familias.set(r.familias);
        this.subFamilias.set(r.subFamilias);
        this.categorias.set(r.categorias);
        this.subCategorias.set(r.subCategorias);
        this.presentaciones.set(r.presentaciones);
        this.guias.set(r.guias);
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        // Sin estos catálogos el detalle sigue sirviendo: los nombres quedan
        // en guion y el stock, que es a lo que se vino, está igual. Se permite
        // reintentar en la próxima apertura.
        this.catalogosPedidos.set(false);
        this.cargandoCatalogos.set(false);
      },
    });
  }

  // ── Datos del producto (solo lectura: son del maestro) ────────────────────

  readonly tipoProducto = computed(() => {
    const tipo = this.producto()?.tipo_producto ?? '';
    return TIPOS[tipo] ?? tipo;
  });

  private readonly nombreUnidad = computed(
    () => new Map(this.unidades().map((u) => [u.id, u.descripcion])),
  );

  unidadNombre(id: string | null | undefined): string {
    return (id && this.nombreUnidad().get(id)) || '—';
  }

  readonly familiaNombre = computed(
    () =>
      this.familias().find((f) => f.id === this.producto()?.familia_id)?.nombre ?? '—',
  );
  readonly subFamiliaNombre = computed(
    () =>
      this.subFamilias().find((sf) => sf.id === this.producto()?.sub_familia_id)
        ?.nombre ?? '—',
  );
  readonly categoriaNombre = computed(
    () =>
      this.categorias().find((c) => c.id === this.producto()?.categoria_id)?.nombre ??
      '—',
  );
  readonly subCategoriaNombre = computed(
    () =>
      this.subCategorias().find((sc) => sc.id === this.producto()?.sub_categoria_id)
        ?.nombre ?? '—',
  );
  readonly presentacionNombre = computed(
    () =>
      this.presentaciones().find((p) => p.id === this.producto()?.presentacion_id)
        ?.descripcion ?? '—',
  );

  // ── Stock en este almacén ─────────────────────────────────────────────────

  /** Cuánto hay. Sin lotes es cero, no un guion: el dato se conoce y es que no
   * hay nada. */
  readonly disponible = computed(() => this.stock()?.disponible ?? 0);

  /** La unidad del disponible: la de venta del producto, que no tiene por qué
   * ser la de la ficha. Por eso se rotula y no se da por hecho. */
  readonly unidadDisponible = computed(() =>
    this.unidadNombre(this.stock()?.unidad_venta_id ?? this.producto()?.unidad_venta),
  );

  readonly unidadesDistintas = computed(() => {
    const ficha = this.ficha();
    return ficha ? unidadesDistintas(ficha, this.stock()) : false;
  });

  readonly severidad = computed(() => {
    const ficha = this.ficha();
    return ficha ? severidadStock(ficha, this.stock()) : 'success';
  });

  readonly claseDisponible = computed(() => {
    const ficha = this.ficha();
    return ficha ? claseStock(ficha, this.stock()) : '';
  });

  /** Qué dice el semáforo, en palabras. El color solo no alcanza: hay que
   * poder leerlo. */
  readonly leyendaStock = computed(() => {
    const severidad = this.severidad();
    if (severidad === 'danger') return 'Bajo el mínimo';
    if (severidad === 'warn') return 'Sobre el máximo';
    return 'En rango';
  });

  // ── Ficha del almacén: lo editable de esta pantalla ───────────────────────

  readonly guardandoFicha = signal(false);
  fUnidadId: string | null = null;
  fStockMinimo = 0;
  fStockMaximo: number | null = null;
  fPrecioVenta = 0;
  fEstado: EstadoExistencia = 'disponible';

  private llenarFormularioFicha(ficha: ProductoAlmacen): void {
    this.fUnidadId = ficha.unidad_medida_id;
    this.fStockMinimo = ficha.stock_minimo;
    this.fStockMaximo = ficha.stock_maximo;
    this.fPrecioVenta = Number(ficha.precio_venta_tienda);
    this.fEstado = ficha.estado;
  }

  /** El máximo por debajo del mínimo lo rechaza el backend; se avisa acá para
   * no gastar el viaje ni mostrar un 422 sin contexto. */
  get errorFicha(): string | null {
    if (this.fStockMaximo != null && this.fStockMaximo < this.fStockMinimo) {
      return 'El stock máximo no puede ser menor que el mínimo';
    }
    return null;
  }

  get fichaValida(): boolean {
    return !!this.fUnidadId && !this.errorFicha;
  }

  guardarFicha(): void {
    const ficha = this.ficha();
    if (!ficha || !this.fichaValida || this.guardandoFicha()) return;
    this.guardandoFicha.set(true);
    this.fichaSvc
      .actualizar(ficha.id, {
        unidad_medida_id: this.fUnidadId!,
        stock_minimo: this.fStockMinimo,
        stock_maximo: this.fStockMaximo,
        precio_venta_tienda: this.fPrecioVenta,
        estado: this.fEstado,
      })
      .subscribe({
        next: (actualizada) => {
          this.guardandoFicha.set(false);
          this.msg.add({ severity: 'success', summary: 'Ficha actualizada', life: 2500 });
          // El mínimo que se acaba de guardar es la mitad del semáforo, y
          // `bajo_minimo` lo decide el servidor: el padre tiene que volver a
          // pedir el stock, no alcanza con repintar.
          this.guardado.emit(actualizada);
        },
        error: (e: AppError) => {
          this.guardandoFicha.set(false);
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: e.message });
        },
      });
  }

  // ── Lotes ─────────────────────────────────────────────────────────────────

  /** Lo que suman los lotes activos y disponibles: el mismo criterio con el
   * que el servidor calcula el disponible. Sirve para que la pestaña cuadre
   * con la cabecera. */
  readonly totalDisponibleEnLotes = computed(() =>
    this.lotes()
      .filter((l) => l.is_active && l.estado === 'disponible')
      .reduce((suma, l) => suma + l.cantidad, 0),
  );

  /** Lotes que entran en su propia ventana de alerta, o en 30 días si nadie la
   * configuró. */
  readonly porVencer = computed(() => this.lotes().filter((l) => this.vencePronto(l)));

  vencePronto(lote: ProductoLote): boolean {
    if (!lote.fecha_vencimiento) return false;
    const dias = lote.dias_alerta_vencimiento ?? 30;
    const hoy = new Date();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
    return new Date(`${lote.fecha_vencimiento}T00:00:00`) <= limite;
  }

  severidadEstado(estado: EstadoExistencia | string): 'success' | 'warn' | 'danger' {
    if (estado === 'disponible') return 'success';
    if (estado === 'agotado') return 'danger';
    return 'warn';
  }

  /** Las guías no tienen número propio: se rotulan por fecha e id corto, que es
   * con lo que se las busca en su pantalla. */
  readonly opcionesGuia = computed(() =>
    this.guias().map((g) => ({ id: g.id, etiqueta: `${g.fecha} · ${g.id.slice(0, 8)}` })),
  );

  etiquetaGuia(lote: ProductoLote): string {
    if (!lote.guia_remision_id) return 'Sin guía';
    const guia = this.guias().find((g) => g.id === lote.guia_remision_id);
    return guia ? guia.fecha : lote.guia_remision_id.slice(0, 8);
  }

  // El lote se edita en la misma tabla, en una fila que se despliega debajo:
  // un segundo diálogo encima de este dejaría al de atrás inalcanzable, y
  // meter ocho editores en las celdas de una fila no entra a lo ancho.
  readonly loteEnEdicion = signal<string | null>(null);
  readonly guardandoLote = signal(false);
  lCodigo = '';
  lCantidad = 0;
  lPrecioCompra = 0;
  lIngreso: Date = new Date();
  lVencimiento: Date | null = null;
  lDiasAlerta: number | null = null;
  lGuiaId: string | null = null;
  lEstado: EstadoExistencia = 'disponible';

  editarLote(lote: ProductoLote): void {
    this.loteEnEdicion.set(lote.id);
    this.lCodigo = lote.codigo_lote;
    this.lCantidad = lote.cantidad;
    this.lPrecioCompra = Number(lote.precio_compra ?? 0);
    this.lIngreso = new Date(`${lote.fecha_ingreso}T00:00:00`);
    this.lVencimiento = lote.fecha_vencimiento
      ? new Date(`${lote.fecha_vencimiento}T00:00:00`)
      : null;
    this.lDiasAlerta = lote.dias_alerta_vencimiento;
    this.lGuiaId = lote.guia_remision_id;
    this.lEstado = lote.estado;
  }

  cancelarLote(): void {
    this.loteEnEdicion.set(null);
  }

  get errorLote(): string | null {
    if (!this.lCodigo.trim()) return 'El código de lote es obligatorio';
    if (this.lVencimiento && this.lIngreso && this.lVencimiento < this.lIngreso) {
      return 'El vencimiento no puede ser anterior al ingreso';
    }
    return null;
  }

  /** `YYYY-MM-DD` en hora local: `toISOString()` pasa por UTC y en Perú
   * devolvería el día anterior. */
  private aIso(fecha: Date): string {
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  guardarLote(): void {
    const id = this.loteEnEdicion();
    if (!id || this.errorLote || this.guardandoLote()) return;
    this.guardandoLote.set(true);
    this.loteSvc
      .actualizar(id, {
        codigo_lote: this.lCodigo.trim(),
        cantidad: this.lCantidad,
        precio_compra: this.lPrecioCompra,
        fecha_ingreso: this.aIso(this.lIngreso),
        fecha_vencimiento: this.lVencimiento ? this.aIso(this.lVencimiento) : null,
        dias_alerta_vencimiento: this.lDiasAlerta,
        guia_remision_id: this.lGuiaId,
        estado: this.lEstado,
      })
      .subscribe({
        next: (actualizado) => {
          this.guardandoLote.set(false);
          this.loteEnEdicion.set(null);
          // Se reemplaza en la lista en vez de volver a pedirla: el orden por
          // vencimiento puede haber cambiado y así se reacomoda sin un viaje.
          this.lotes.update((lotes) =>
            this.ordenados(lotes.map((l) => (l.id === actualizado.id ? actualizado : l))),
          );
          this.msg.add({ severity: 'success', summary: 'Lote actualizado', life: 2500 });
          // La cantidad y el estado del lote son de lo que sale el disponible,
          // y lo suma el servidor: el padre tiene que volver a pedirlo.
          this.lotesCambiados.emit();
        },
        error: (e: AppError) => {
          this.guardandoLote.set(false);
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: e.message });
        },
      });
  }

  // ── Diálogo ───────────────────────────────────────────────────────────────

  alCambiarVisible(visible: boolean): void {
    if (!visible) this.cerrar.emit();
  }
}
