import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Ubicacion, campoDe } from '../../models/organizacion.model';
import { TIPOS_UBICACION, TipoUbicacion } from '../../models/tipos-ubicacion';
import { ClaveUbicacion, RegistroUbicaciones } from '../../services/organizacion.service';

/** Zonas, sedes y markets con una sola pantalla.
 *
 * Cuál se muestra lo dice `data.clave` de la ruta; de quién cuelga y cómo se
 * llama salen del descriptor. Ver `tipos-ubicacion.ts`.
 */
@Component({
  standalone: true,
  selector: 'app-ubicacion-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './ubicacion-lista.html',
})
export class UbicacionLista implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly registro = inject(RegistroUbicaciones);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly tipo = signal<TipoUbicacion>(TIPOS_UBICACION.zonas);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Ubicacion[]>([]);
  readonly padres = signal<Ubicacion[]>([]);
  readonly verInactivos = signal(false);

  readonly nombrePadre = computed(
    () => new Map(this.padres().map((p) => [p.id, p.nombre])),
  );

  readonly padreFiltro = signal<string | null>(null);
  readonly busqueda = signal('');

  readonly filtrados = computed(() => {
    const padre = this.padreFiltro();
    const campo = this.tipo().padre?.campo;
    const q = this.busqueda().trim().toLowerCase();
    return this.items().filter((u) => {
      if (padre && campo && campoDe(u, campo) !== padre) return false;
      if (!q) return true;
      return (
        u.nombre.toLowerCase().includes(q) || u.codigo.toLowerCase().includes(q)
      );
    });
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Ubicacion | null>(null);
  nombre = '';
  codigo = '';
  padreId: string | null = null;

  ngOnInit(): void {
    // La clave viaja en la ruta: al pasar de "zonas" a "sedes" Angular
    // reutiliza el componente y `ngOnInit` no se vuelve a ejecutar.
    this.ruta.data.subscribe((data) => {
      this.tipo.set(TIPOS_UBICACION[data['clave'] as ClaveUbicacion]);
      this.padreFiltro.set(null);
      this.busqueda.set('');
      this.cargar();
      this.cargarPadres();
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.registro
      .servicio(this.tipo().clave)
      .listar({ solo_activos: !this.verInactivos(), limite: 500 })
      .subscribe({
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

  private cargarPadres(): void {
    const padre = this.tipo().padre;
    if (!padre) {
      this.padres.set([]);
      return;
    }
    this.registro
      .servicio(padre.fuente)
      .listar({ limite: 500 })
      .subscribe({
        next: (ps) => this.padres.set(ps),
        error: () => this.padres.set([]),
      });
  }

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  nuevo(): void {
    this.editando.set(null);
    this.nombre = '';
    this.codigo = '';
    // Si la lista está filtrada por un padre, se propone ese: crear varias
    // sedes de la misma zona es lo normal.
    this.padreId = this.padreFiltro();
    this.dialogoAbierto.set(true);
  }

  editar(u: Ubicacion): void {
    this.editando.set(u);
    this.nombre = u.nombre;
    this.codigo = u.codigo;
    const campo = this.tipo().padre?.campo;
    this.padreId = campo ? campoDe(u, campo) : null;
    this.dialogoAbierto.set(true);
  }

  get valido(): boolean {
    if (!this.nombre.trim() || !this.codigo.trim()) return false;
    if (this.tipo().padre && !this.padreId) return false;
    return true;
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const t = this.tipo();
    const enEdicion = this.editando();
    const datos: Record<string, unknown> = {
      nombre: this.nombre.trim(),
      codigo: this.codigo.trim(),
    };
    if (t.padre) datos[t.padre.campo] = this.padreId;

    const svc = this.registro.servicio(t.clave);
    const peticion = enEdicion ? svc.actualizar(enEdicion.id, datos) : svc.crear(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoAbierto.set(false);
        this.msg.add({
          severity: 'success',
          summary: enEdicion ? 'Cambios guardados' : 'Registro creado',
          detail: `Se guardó ${t.articulo} ${t.singular}.`,
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

  /** El padre de una fila, para la columna de la tabla. */
  padreDe(u: Ubicacion): string {
    const campo = this.tipo().padre?.campo;
    if (!campo) return '—';
    const id = campoDe(u, campo);
    return (id && this.nombrePadre().get(id)) || '—';
  }

  darDeBaja(u: Ubicacion): void {
    const t = this.tipo();
    this.confirm.confirm({
      header: 'Dar de baja',
      message:
        `Se dará de baja ${t.articulo} ${t.singular} ${u.nombre}. ` +
        `Sus ${t.contiene} no se borran, pero quedan colgando de un registro inactivo.`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.registro
          .servicio(t.clave)
          .desactivar(u.id)
          .subscribe({
            next: () => {
              this.msg.add({ severity: 'success', summary: 'Dado de baja', life: 2500 });
              this.cargar();
            },
            error: (e: AppError) =>
              this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
          }),
    });
  }
}
