import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Presentacion } from '../../models/catalogo.model';
import { PresentacionService } from '../../services/productos.service';

@Component({
  standalone: true,
  selector: 'app-presentacion-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './presentacion-lista.html',
})
export class PresentacionLista implements OnInit {
  private readonly svc = inject(PresentacionService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Presentacion[]>([]);
  readonly verInactivos = signal(false);

  readonly busqueda = signal('');
  readonly filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (p) =>
        p.descripcion.toLowerCase().includes(q) ||
        (p.codigo ?? '').toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Presentacion | null>(null);
  descripcion = '';
  codigo = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.listar({ solo_activos: !this.verInactivos(), limite: 500 }).subscribe({
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
    this.dialogoAbierto.set(true);
  }

  editar(item: Presentacion): void {
    this.editando.set(item);
    this.descripcion = item.descripcion;
    this.codigo = item.codigo ?? '';
    this.dialogoAbierto.set(true);
  }

  guardar(): void {
    if (!this.descripcion.trim() || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = {
      descripcion: this.descripcion.trim(),
      codigo: this.codigo.trim() || null,
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
          summary: enEdicion ? 'Presentación actualizada' : 'Presentación creada',
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

  darDeBaja(item: Presentacion): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: 'Se dará de baja ' + item.descripcion + '.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(item.id).subscribe({
          next: () => {
            this.msg.add({
              severity: 'success',
              summary: 'Presentación dada de baja',
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
