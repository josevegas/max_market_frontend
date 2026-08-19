import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { catchError, forkJoin, map, of } from 'rxjs';

import { AppError } from '../../../../core/http/api-error';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import {
  Almacen,
  ESTADOS_EXISTENCIA,
  EstadoExistencia,
  ProductoAlmacen,
  StockDeProducto,
  UnidadMedida,
} from '../../models/almacenes.model';
import {
  claseStock,
  severidadStock,
  unidadesDistintas,
} from '../../models/stock-semaforo';
import {
  AlmacenService,
  ProductoAlmacenService,
  UnidadMedidaService,
} from '../../services/almacenes.service';
import { ProductoAlmacenDetalle } from '../producto-almacen-detalle/producto-almacen-detalle';

/** Qué guarda cada almacén de cada producto: cuánto debe haber, cuánto hay y a
 * cuánto se vende.
 *
 * La ficha (`producto_almacen`) es configuración —el mínimo, el techo, el
 * precio— y el stock real lo suman los lotes, que es otra tabla. Se juntan acá
 * porque la pregunta del operador es una sola: "¿tengo que reponer esto?".
 */
@Component({
  standalone: true,
  selector: 'app-producto-almacen-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputNumberModule,
    InputTextModule,
    ProductoAlmacenDetalle,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './producto-almacen-lista.html',
})
export class ProductoAlmacenLista implements OnInit {
  private readonly svc = inject(ProductoAlmacenService);
  private readonly almacenes = inject(AlmacenService);
  private readonly productos = inject(ProductoService);
  private readonly unidades = inject(UnidadMedidaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly estados = ESTADOS_EXISTENCIA;

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<ProductoAlmacen[]>([]);
  readonly almacenesLista = signal<Almacen[]>([]);
  readonly productosLista = signal<Producto[]>([]);
  readonly unidadesLista = signal<UnidadMedida[]>([]);
  readonly verInactivos = signal(false);

  /** Stock de lotes indexado por `almacen_id|producto_id`.
   *
   * Se guarda en un mapa y no en una lista porque la tabla lo consulta por
   * fila: la respuesta viene por almacén y hay que cruzarla con las fichas.
   */
  readonly stockPorFila = signal(new Map<string, StockDeProducto>());
  readonly cargandoStock = signal(false);

  readonly nombreAlmacen = computed(
    () => new Map(this.almacenesLista().map((a) => [a.id, a.nombre])),
  );
  readonly nombreProducto = computed(
    () => new Map(this.productosLista().map((p) => [p.id, p.descripcion_corta])),
  );
  readonly nombreUnidad = computed(
    () => new Map(this.unidadesLista().map((u) => [u.id, u.descripcion])),
  );

  /** Filtro por almacén: es la pregunta natural ("qué guarda esta tienda"),
   *  y la lista completa mezcla todos los almacenes. */
  readonly almacenFiltro = signal<string | null>(null);
  readonly busqueda = signal('');

  readonly filtrados = computed(() => {
    const almacen = this.almacenFiltro();
    const q = this.busqueda().trim().toLowerCase();
    const nombres = this.nombreProducto();
    return this.items().filter((pa) => {
      if (almacen && pa.almacen_id !== almacen) return false;
      if (!q) return true;
      return (nombres.get(pa.producto_id) ?? '').toLowerCase().includes(q);
    });
  });

  /** La fila cuyo detalle está abierto, o `null` con el detalle cerrado. Es
   * la fila entera y no su id: el diálogo necesita el mínimo, el máximo y el
   * precio, que ya vinieron en el listado. */
  readonly detalle = signal<ProductoAlmacen | null>(null);

  readonly productoDelDetalle = computed(() => {
    const pa = this.detalle();
    return pa ? (this.productosLista().find((p) => p.id === pa.producto_id) ?? null) : null;
  });
  readonly almacenDelDetalle = computed(() => {
    const pa = this.detalle();
    return pa ? (this.almacenesLista().find((a) => a.id === pa.almacen_id) ?? null) : null;
  });
  readonly stockDelDetalle = computed(() => {
    const pa = this.detalle();
    return pa ? (this.stockPorFila().get(`${pa.almacen_id}|${pa.producto_id}`) ?? null) : null;
  });

  /** El diálogo es solo de alta: la ficha existente se corrige en el detalle
   * que abre la fila, que es donde además están sus lotes. */
  readonly dialogoAbierto = signal(false);
  almacenId: string | null = null;
  productoId: string | null = null;
  unidadId: string | null = null;
  stockMinimo = 1;
  stockMaximo: number | null = null;
  precioVenta = 0;
  estado: EstadoExistencia = 'disponible';

  ngOnInit(): void {
    this.cargar();
    this.almacenes.listar({ limite: 500 }).subscribe({
      // El stock se pide acá dentro y no en paralelo: hay que saber qué
      // almacenes existen antes de poder preguntarle a cada uno.
      next: (a) => {
        this.almacenesLista.set(a);
        this.cargarStock();
      },
      error: () => this.almacenesLista.set([]),
    });
    this.productos.listarTodo().subscribe({
      next: (p) => this.productosLista.set(p),
      error: () => this.productosLista.set([]),
    });
    this.unidades.listar({ limite: 500 }).subscribe({
      next: (u) => this.unidadesLista.set(u),
      error: () => this.unidadesLista.set([]),
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.listarTodo({ solo_activos: !this.verInactivos() }).subscribe({
      next: (items) => {
        this.items.set(items);
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message });
      },
    });
  }

  /** Trae el stock de los almacenes que la tabla está mostrando.
   *
   * El endpoint cuelga del almacén (`/almacenes/{id}/stock`) porque el stock se
   * calcula por almacén, así que con el filtro en "Todos" hay que preguntarle a
   * cada uno. Son tantas peticiones como almacenes, que es un catálogo corto;
   * si algún día deja de serlo, el arreglo es un endpoint que acepte varios y
   * no cambiar nada de acá.
   *
   * Un almacén que falla no tumba al resto: su tramo vuelve vacío y sus filas
   * quedan sin dato en vez de dejar la columna entera en blanco.
   */
  private cargarStock(): void {
    const almacen = this.almacenFiltro();
    const objetivo = almacen
      ? this.almacenesLista().filter((a) => a.id === almacen)
      : this.almacenesLista();
    if (!objetivo.length) {
      this.stockPorFila.set(new Map());
      return;
    }

    this.cargandoStock.set(true);
    forkJoin(
      objetivo.map((a) =>
        this.almacenes.stock(a.id).pipe(
          map((filas) => ({ almacenId: a.id, filas })),
          catchError(() => of({ almacenId: a.id, filas: [] as StockDeProducto[] })),
        ),
      ),
    ).subscribe({
      next: (tramos) => {
        const mapa = new Map<string, StockDeProducto>();
        for (const { almacenId, filas } of tramos) {
          for (const fila of filas) mapa.set(`${almacenId}|${fila.producto_id}`, fila);
        }
        this.stockPorFila.set(mapa);
        this.cargandoStock.set(false);
      },
      error: () => this.cargandoStock.set(false),
    });
  }

  /** El stock de una fila de la tabla, o `null` si ese producto no tiene lotes
   * en ese almacén (que no es lo mismo que no haberlo consultado todavía). */
  stockDe(pa: ProductoAlmacen): StockDeProducto | null {
    return this.stockPorFila().get(`${pa.almacen_id}|${pa.producto_id}`) ?? null;
  }

  /** Cuánto hay, en la unidad de venta del producto. Sin lotes es cero, no un
   * guion: el dato se conoce y es que no hay nada. */
  disponibleDe(pa: ProductoAlmacen): number {
    return this.stockDe(pa)?.disponible ?? 0;
  }

  /** La unidad en la que está el disponible: la de venta del producto, que no
   * tiene por qué ser la de la ficha. Por eso se rotula la columna y no se da
   * por hecho que es la misma. */
  unidadDisponibleDe(pa: ProductoAlmacen): string {
    const stock = this.stockDe(pa);
    const unidadId =
      stock?.unidad_venta_id ??
      this.productosLista().find((p) => p.id === pa.producto_id)?.unidad_venta;
    return (unidadId && this.nombreUnidad().get(unidadId)) || '';
  }

  // El semáforo vive en `stock-semaforo`: el detalle que se abre desde la fila
  // pinta el mismo número y con la regla duplicada los dos podían discrepar.
  unidadesDistintas(pa: ProductoAlmacen): boolean {
    return unidadesDistintas(pa, this.stockDe(pa));
  }

  claseStock(pa: ProductoAlmacen): string {
    return claseStock(pa, this.stockDe(pa));
  }

  severidadStock(pa: ProductoAlmacen): 'success' | 'warn' | 'danger' {
    return severidadStock(pa, this.stockDe(pa));
  }

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  /** El filtro de almacén no solo esconde filas: cambia a qué almacenes hay que
   * preguntarles el stock. */
  alCambiarAlmacen(id: string | null): void {
    this.almacenFiltro.set(id);
    this.cargarStock();
  }

  /** El clic en la fila abre el detalle, que es donde se mira y se corrige
   * todo lo del producto en este almacén: la ficha y sus lotes. */
  abrirDetalle(pa: ProductoAlmacen): void {
    this.detalle.set(pa);
  }

  /** La ficha se guardó desde el detalle. Se refresca la lista y el stock —el
   * mínimo es la mitad del semáforo y `bajo_minimo` lo decide el servidor— y
   * el detalle se queda abierto con lo que acaba de escribirse. */
  alGuardarFicha(pa: ProductoAlmacen): void {
    this.detalle.set(pa);
    this.cargar();
    this.cargarStock();
  }

  /** Cambió un lote: la cantidad y el estado son de lo que sale el disponible,
   * y lo suma el servidor. */
  alCambiarLotes(): void {
    this.cargarStock();
  }

  nuevo(): void {
    this.almacenId = this.almacenFiltro();
    this.productoId = null;
    this.unidadId = null;
    this.stockMinimo = 1;
    this.stockMaximo = null;
    this.precioVenta = 0;
    this.estado = 'disponible';
    this.dialogoAbierto.set(true);
  }

  /** El máximo por debajo del mínimo lo rechaza el backend; se avisa acá para
   *  no gastar el viaje ni mostrar un 422 sin contexto. */
  get errorStock(): string | null {
    if (this.stockMaximo != null && this.stockMaximo < this.stockMinimo) {
      return 'El stock máximo no puede ser menor que el mínimo';
    }
    return null;
  }

  get valido(): boolean {
    return (
      !!this.almacenId && !!this.productoId && !!this.unidadId && !this.errorStock
    );
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const datos = {
      almacen_id: this.almacenId!,
      producto_id: this.productoId!,
      unidad_medida_id: this.unidadId!,
      stock_minimo: this.stockMinimo,
      stock_maximo: this.stockMaximo,
      precio_venta_tienda: this.precioVenta,
      estado: this.estado,
    };
    this.svc.crear(datos).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoAbierto.set(false);
        this.msg.add({
          severity: 'success',
          summary: 'Producto asignado al almacén',
          life: 2500,
        });
        this.cargar();
        // El mínimo que se acaba de guardar es la mitad del semáforo, así que
        // el stock hay que volver a pedirlo: `bajo_minimo` lo decide el
        // servidor y con el mínimo viejo diría otra cosa.
        this.cargarStock();
      },
      error: (e: AppError) => {
        this.guardando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: e.message });
      },
    });
  }

  darDeBaja(pa: ProductoAlmacen): void {
    const producto = this.nombreProducto().get(pa.producto_id) ?? 'el producto';
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se quitará ${producto} del almacén. Seguirá visible activando "ver inactivos".`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(pa.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Registro dado de baja', life: 2500 });
            this.cargar();
            this.cargarStock();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }

  severidadEstado(estado: EstadoExistencia): 'success' | 'warn' | 'danger' {
    if (estado === 'disponible') return 'success';
    if (estado === 'agotado') return 'danger';
    return 'warn';
  }
}
