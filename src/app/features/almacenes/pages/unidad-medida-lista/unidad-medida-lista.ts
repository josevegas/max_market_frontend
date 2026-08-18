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
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { UnidadMedida } from '../../models/almacenes.model';
import { UnidadMedidaService } from '../../services/almacenes.service';

/** Maestro de unidades de medida.
 *
 * Es el catálogo que da sentido a las cantidades del resto del sistema: el
 * stock de un producto en un almacén, las líneas de un documento y los lotes
 * apuntan todos acá. Hasta ahora solo se consultaba desde los selectores y las
 * altas había que hacerlas por fuera de la aplicación.
 */
@Component({
  standalone: true,
  selector: 'app-unidad-medida-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './unidad-medida-lista.html',
})
export class UnidadMedidaLista implements OnInit {
  private readonly svc = inject(UnidadMedidaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<UnidadMedida[]>([]);
  readonly verInactivos = signal(false);

  readonly busqueda = signal('');
  readonly filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (u) =>
        u.descripcion.toLowerCase().includes(q) ||
        u.codigo.toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<UnidadMedida | null>(null);
  descripcion = '';
  codigo = '';
  /** Arranca en 1, que es la unidad base y el caso más común. Solo se cambia
   * para empaques: una CAJA12 vale 12 unidades mínimas. */
  factorConversion = 1;

  ngOnInit(): void {
    this.cargar();
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

  nueva(): void {
    this.editando.set(null);
    this.descripcion = '';
    this.codigo = '';
    this.factorConversion = 1;
    this.dialogoAbierto.set(true);
  }

  editar(item: UnidadMedida): void {
    this.editando.set(item);
    this.descripcion = item.descripcion;
    this.codigo = item.codigo;
    // Las unidades anteriores a este campo no tienen factor; editarlas es la
    // vía para completarlo, y 1 es el valor que hay que confirmar o cambiar.
    this.factorConversion = item.factor_conversion ?? 1;
    this.dialogoAbierto.set(true);
  }

  puedeGuardar(): boolean {
    return (
      !!this.descripcion.trim() &&
      !!this.codigo.trim() &&
      Number.isInteger(this.factorConversion) &&
      this.factorConversion >= 1
    );
  }

  guardar(): void {
    if (!this.puedeGuardar() || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = {
      descripcion: this.descripcion.trim(),
      // En mayúsculas: es lo que se imprime en los documentos, y "kg" y "KG"
      // como dos unidades distintas sería un error caro de deshacer.
      codigo: this.codigo.trim().toUpperCase(),
      // Viaja con la unidad: la API lo guarda en `tabla_equivalencia` dentro
      // de la misma transacción, así que no puede quedar una sin la otra.
      factor_conversion: this.factorConversion,
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
          summary: enEdicion ? 'Unidad actualizada' : 'Unidad creada',
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

  darDeBaja(item: UnidadMedida): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message:
        `Se dará de baja ${item.descripcion} (${item.codigo}). ` +
        'Los productos y movimientos que ya la usan la conservan.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(item.id).subscribe({
          next: () => {
            this.msg.add({
              severity: 'success',
              summary: 'Unidad dada de baja',
              life: 2500,
            });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
