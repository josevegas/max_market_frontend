import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import {
  ConsultaRuc,
  Empresa,
  EmpresaUpdate,
  ProductoDelProveedor,
} from '../../models/catalogo.model';
import { EmpresaService } from '../../services/empresas.service';
import { ProveedorProductoService } from '../../services/proveedor-productos.service';

/** Un RUC peruano son 11 dígitos; el backend rechaza cualquier otra cosa. */
const LARGO_RUC = 11;

@Component({
  standalone: true,
  selector: 'app-empresa-form',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './empresa-form.html',
})
export class EmpresaForm implements OnInit {
  private readonly svc = inject(EmpresaService);
  private readonly asignacionSvc = inject(ProveedorProductoService);
  private readonly productoSvc = inject(ProductoService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly cargando = signal(false);
  readonly consultando = signal(false);
  readonly guardando = signal(false);

  readonly empresa = signal<Empresa | null>(null);
  readonly esNuevo = computed(() => this.empresa() === null);

  // ── Alta: el RUC se consulta en SUNAT y de ahí sale todo lo demás ─────────
  ruc = '';
  readonly consulta = signal<ConsultaRuc | null>(null);
  esProveedor = true;

  /** Getter y no `computed`: `ruc` es una propiedad plana, y un `computed` que
   *  la leyera quedaría cacheado sin recalcular nunca (no es una señal). */
  get rucValido(): boolean {
    const v = this.ruc.trim();
    return v.length === LARGO_RUC && /^\d+$/.test(v);
  }

  // ── Edición: solo contacto y condición de proveedor ───────────────────────
  form: EmpresaUpdate = { direccion: null, telefono: null, email: null, es_proveedor: false };

  // ── Productos que distribuye ──────────────────────────────────────────────
  readonly asignados = signal<ProductoDelProveedor[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly cargandoAsignados = signal(false);
  readonly asignando = signal(false);

  nuevoProductoId: string | null = null;
  nuevoTiempo = 1;

  /** Plazo al entrar en la celda: sirve para no mandar un PUT si al salir el
   *  valor no cambió. */
  private tiempoPrevio: number | null = null;

  /** Acá sí corresponde `computed`: ambas dependencias son señales. Se ocultan
   *  los ya asignados para que el alta no pise a la edición en línea. */
  readonly productosDisponibles = computed(() => {
    const yaEstan = new Set(this.asignados().map((a) => a.producto_id));
    return this.productos().filter((p) => !yaEstan.has(p.id));
  });

  /** El backend rechaza asignar productos a una empresa que no es proveedora
   *  (400), así que la tabla no se muestra en ese caso. */
  get puedeAsignar(): boolean {
    return this.empresa()?.es_proveedor === true;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'nuevo') this.cargar(id);
  }

  private cargar(id: string): void {
    this.cargando.set(true);
    this.svc.obtener(id).subscribe({
      next: (e) => {
        this.empresa.set(e);
        this.form = {
          direccion: e.direccion,
          telefono: e.telefono,
          email: e.email,
          es_proveedor: e.es_proveedor,
        };
        this.cargando.set(false);
        if (e.es_proveedor) this.cargarAsignaciones();
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message });
      },
    });
  }

  /** Catálogo del proveedor y lista de productos para el selector. */
  private cargarAsignaciones(): void {
    const actual = this.empresa();
    if (!actual) return;

    this.cargandoAsignados.set(true);
    this.asignacionSvc.productosDe(actual.id).subscribe({
      next: (items) => {
        this.asignados.set(items);
        this.cargandoAsignados.set(false);
      },
      error: (e: AppError) => {
        this.cargandoAsignados.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message });
      },
    });

    if (this.productos().length === 0) {
      this.productoSvc.listar({ limite: 500 }).subscribe({
        next: (items) => this.productos.set(items),
      });
    }
  }

  /** Al tocar el RUC se descarta la consulta previa: si no, quedaría en
   *  pantalla la razón social de otro contribuyente. */
  alCambiarRuc(): void {
    if (this.consulta()) this.consulta.set(null);
  }

  consultarRuc(): void {
    if (!this.rucValido || this.consultando()) return;
    this.consultando.set(true);
    this.svc.consultarRuc(this.ruc.trim()).subscribe({
      next: (datos) => {
        this.consulta.set(datos);
        this.consultando.set(false);
      },
      error: (e: AppError) => {
        this.consultando.set(false);
        this.consulta.set(null);
        this.msg.add({ severity: 'error', summary: 'No se pudo consultar el RUC', detail: e.message });
      },
    });
  }

  /** SUNAT responde "SI"/"NO" en los indicadores de agente. */
  esSi(valor: string | null): boolean {
    return (valor ?? '').trim().toUpperCase() === 'SI';
  }

  crear(): void {
    const datos = this.consulta();
    if (!datos || this.guardando()) return;
    this.guardando.set(true);
    this.svc.crearDesdeRuc(datos.ruc, this.esProveedor).subscribe({
      next: (e) => {
        this.guardando.set(false);
        this.msg.add({ severity: 'success', summary: 'Empresa creada', life: 2500 });
        this.router.navigate(['/empresas', e.id]);
      },
      error: (e: AppError) => {
        this.guardando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo crear', detail: e.message });
      },
    });
  }

  guardar(): void {
    const actual = this.empresa();
    if (!actual || this.guardando()) return;
    this.guardando.set(true);
    this.svc.actualizar(actual.id, this.form).subscribe({
      next: (e) => {
        this.guardando.set(false);
        this.empresa.set(e);
        this.msg.add({ severity: 'success', summary: 'Empresa actualizada', life: 2500 });
        // Si se acaba de marcar como proveedora, el panel pasa a estar
        // disponible y necesita sus datos.
        if (e.es_proveedor && this.productos().length === 0) this.cargarAsignaciones();
      },
      error: (e: AppError) => {
        this.guardando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: e.message });
      },
    });
  }

  // ── Productos que distribuye ──────────────────────────────────────────────

  asignarProducto(): void {
    const actual = this.empresa();
    if (!actual || !this.nuevoProductoId || this.asignando()) return;

    this.asignando.set(true);
    this.asignacionSvc.asignar(actual.id, this.nuevoProductoId, this.nuevoTiempo).subscribe({
      next: () => {
        this.asignando.set(false);
        this.nuevoProductoId = null;
        this.nuevoTiempo = 1;
        this.msg.add({ severity: 'success', summary: 'Producto asignado', life: 2000 });
        // Se recarga porque el PUT no devuelve el SKU ni la descripción.
        this.cargarAsignaciones();
      },
      error: (e: AppError) => {
        this.asignando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo asignar', detail: e.message });
      },
    });
  }

  alEnfocarTiempo(fila: ProductoDelProveedor): void {
    this.tiempoPrevio = fila.tiempo_atencion;
  }

  /** El PUT va al salir de la celda y no en cada pulsación: si no, se mandaría
   *  una petición por dígito tecleado. */
  alSalirDeTiempo(fila: ProductoDelProveedor): void {
    const actual = this.empresa();
    const previo = this.tiempoPrevio;
    this.tiempoPrevio = null;

    if (!actual || previo === null || fila.tiempo_atencion === previo) return;
    if (fila.tiempo_atencion === null || fila.tiempo_atencion === undefined) {
      fila.tiempo_atencion = previo;
      return;
    }

    this.asignacionSvc.asignar(actual.id, fila.producto_id, fila.tiempo_atencion).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Plazo actualizado', life: 2000 }),
      error: (e: AppError) => {
        fila.tiempo_atencion = previo; // se revierte para no mostrar un dato que no se guardó
        this.msg.add({ severity: 'error', summary: 'No se pudo actualizar', detail: e.message });
      },
    });
  }

  quitarProducto(fila: ProductoDelProveedor): void {
    const actual = this.empresa();
    if (!actual) return;

    this.confirm.confirm({
      header: 'Quitar del catálogo',
      message:
        'El proveedor dejará de distribuir ' +
        fila.sku +
        '. Es una baja lógica: volver a asignarlo lo reactiva.',
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.asignacionSvc.quitar(actual.id, fila.producto_id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Producto quitado', life: 2000 });
            this.cargarAsignaciones();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }

  volver(): void {
    this.router.navigate(['/empresas']);
  }
}
