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

import { AppError } from '../../../../core/http/api-error';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import {
  Almacen,
  ESTADOS_EXISTENCIA,
  EstadoExistencia,
  ProductoAlmacen,
  UnidadMedida,
} from '../../models/almacenes.model';
import {
  AlmacenService,
  ProductoAlmacenService,
  UnidadMedidaService,
} from '../../services/almacenes.service';

/** Stock configurado de cada producto en cada almacén: cuánto debe haber y a
 * cuánto se vende. Las existencias reales salen de los movimientos. */
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
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
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

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<ProductoAlmacen | null>(null);
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
      next: (a) => this.almacenesLista.set(a),
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

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  nuevo(): void {
    this.editando.set(null);
    this.almacenId = this.almacenFiltro();
    this.productoId = null;
    this.unidadId = null;
    this.stockMinimo = 1;
    this.stockMaximo = null;
    this.precioVenta = 0;
    this.estado = 'disponible';
    this.dialogoAbierto.set(true);
  }

  editar(pa: ProductoAlmacen): void {
    this.editando.set(pa);
    this.almacenId = pa.almacen_id;
    this.productoId = pa.producto_id;
    this.unidadId = pa.unidad_medida_id;
    this.stockMinimo = pa.stock_minimo;
    this.stockMaximo = pa.stock_maximo;
    this.precioVenta = Number(pa.precio_venta_tienda);
    this.estado = pa.estado;
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

    const enEdicion = this.editando();
    const datos = {
      almacen_id: this.almacenId!,
      producto_id: this.productoId!,
      unidad_medida_id: this.unidadId!,
      stock_minimo: this.stockMinimo,
      stock_maximo: this.stockMaximo,
      precio_venta_tienda: this.precioVenta,
      estado: this.estado,
    };
    const peticion = enEdicion
      ? this.svc.actualizar(enEdicion.id, datos)
      : this.svc.crear(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoAbierto.set(false);
        this.msg.add({
          severity: 'success',
          summary: enEdicion ? 'Stock actualizado' : 'Producto asignado al almacén',
          life: 2500,
        });
        this.cargar();
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
