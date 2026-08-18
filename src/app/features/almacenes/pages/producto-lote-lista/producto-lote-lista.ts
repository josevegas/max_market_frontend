import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
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
import { GuiaRemision } from '../../../movimientos/models/movimientos.model';
import { GuiaRemisionService } from '../../../movimientos/services/movimientos.service';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import {
  ESTADOS_EXISTENCIA,
  EstadoExistencia,
  ProductoLote,
  UnidadMedida,
} from '../../models/almacenes.model';
import { ProductoLoteService, UnidadMedidaService } from '../../services/almacenes.service';

/** Lotes ingresados. Cada uno nace de una guía de remisión: es lo que ata la
 * mercadería al documento que la trajo. */
@Component({
  standalone: true,
  selector: 'app-producto-lote-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePickerModule,
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
  templateUrl: './producto-lote-lista.html',
})
export class ProductoLoteLista implements OnInit {
  private readonly svc = inject(ProductoLoteService);
  private readonly guias = inject(GuiaRemisionService);
  private readonly productos = inject(ProductoService);
  private readonly unidades = inject(UnidadMedidaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly estados = ESTADOS_EXISTENCIA;

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<ProductoLote[]>([]);
  readonly guiasLista = signal<GuiaRemision[]>([]);
  readonly productosLista = signal<Producto[]>([]);
  readonly unidadesLista = signal<UnidadMedida[]>([]);
  readonly verInactivos = signal(false);

  readonly nombreProducto = computed(
    () => new Map(this.productosLista().map((p) => [p.id, p.descripcion_corta])),
  );
  readonly nombreUnidad = computed(
    () => new Map(this.unidadesLista().map((u) => [u.id, u.descripcion])),
  );
  /** Las guías no tienen número propio: se rotulan por fecha e id corto. */
  readonly etiquetaGuia = computed(
    () =>
      new Map(this.guiasLista().map((g) => [g.id, `${g.fecha} · ${g.id.slice(0, 8)}`])),
  );

  readonly busqueda = signal('');
  readonly soloPorVencer = signal(false);

  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const nombres = this.nombreProducto();
    const hoy = new Date();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30);
    return this.items().filter((l) => {
      if (this.soloPorVencer()) {
        if (!l.fecha_vencimiento) return false;
        if (new Date(`${l.fecha_vencimiento}T00:00:00`) > limite) return false;
      }
      if (!q) return true;
      return (
        l.codigo_lote.toLowerCase().includes(q) ||
        (nombres.get(l.producto_id) ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<ProductoLote | null>(null);
  guiaId: string | null = null;
  productoId: string | null = null;
  unidadId: string | null = null;
  fechaIngreso: Date = new Date();
  fechaVencimiento: Date | null = null;
  cantidad = 0;
  codigoLote = '';
  estado: EstadoExistencia = 'disponible';

  ngOnInit(): void {
    this.cargar();
    this.guias.listar({ limite: 500 }).subscribe({
      next: (g) => this.guiasLista.set(g),
      error: () => this.guiasLista.set([]),
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
    this.guiaId = null;
    this.productoId = null;
    this.unidadId = null;
    this.fechaIngreso = new Date();
    this.fechaVencimiento = null;
    this.cantidad = 0;
    this.codigoLote = '';
    this.estado = 'disponible';
    this.dialogoAbierto.set(true);
  }

  editar(lote: ProductoLote): void {
    this.editando.set(lote);
    this.guiaId = lote.guia_remision_id;
    this.productoId = lote.producto_id;
    this.unidadId = lote.unidad_medida_id;
    this.fechaIngreso = new Date(`${lote.fecha_ingreso}T00:00:00`);
    this.fechaVencimiento = lote.fecha_vencimiento
      ? new Date(`${lote.fecha_vencimiento}T00:00:00`)
      : null;
    this.cantidad = lote.cantidad;
    this.codigoLote = lote.codigo_lote;
    this.estado = lote.estado;
    this.dialogoAbierto.set(true);
  }

  get errorFechas(): string | null {
    if (
      this.fechaVencimiento &&
      this.fechaIngreso &&
      this.fechaVencimiento < this.fechaIngreso
    ) {
      return 'El vencimiento no puede ser anterior al ingreso';
    }
    return null;
  }

  get valido(): boolean {
    return (
      !!this.guiaId &&
      !!this.productoId &&
      !!this.unidadId &&
      !!this.codigoLote.trim() &&
      !this.errorFechas
    );
  }

  /** `YYYY-MM-DD` en hora local: `toISOString()` pasa por UTC y en Perú
   * devolvería el día anterior. */
  private aIso(fecha: Date): string {
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = {
      guia_remision_id: this.guiaId!,
      producto_id: this.productoId!,
      unidad_medida_id: this.unidadId!,
      fecha_ingreso: this.aIso(this.fechaIngreso),
      fecha_vencimiento: this.fechaVencimiento ? this.aIso(this.fechaVencimiento) : null,
      cantidad: this.cantidad,
      codigo_lote: this.codigoLote.trim(),
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
          summary: enEdicion ? 'Lote actualizado' : 'Lote registrado',
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

  darDeBaja(lote: ProductoLote): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se dará de baja el lote ${lote.codigo_lote}. Seguirá visible activando "ver inactivos".`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(lote.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Lote dado de baja', life: 2500 });
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

  /** Un lote vencido o por vencer se marca en la lista: es lo que hay que
   * mirar antes que nada al abrir esta pantalla. */
  vencimientoProximo(lote: ProductoLote): boolean {
    if (!lote.fecha_vencimiento) return false;
    const hoy = new Date();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30);
    return new Date(`${lote.fecha_vencimiento}T00:00:00`) <= limite;
  }
}
