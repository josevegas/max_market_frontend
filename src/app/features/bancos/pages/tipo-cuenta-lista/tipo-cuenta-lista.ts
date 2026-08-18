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
import { TipoCuenta } from '../../models/bancos.model';
import { TipoCuentaService } from '../../services/bancos.service';

/** Maestro de tipos de cuenta: corriente, ahorros, detracciones. */
@Component({
  standalone: true,
  selector: 'app-tipo-cuenta-lista',
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
  templateUrl: './tipo-cuenta-lista.html',
})
export class TipoCuentaLista implements OnInit {
  private readonly svc = inject(TipoCuentaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<TipoCuenta[]>([]);
  readonly verInactivos = signal(false);

  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (t) =>
        t.descripcion.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<TipoCuenta | null>(null);
  descripcion = '';
  codigo = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.listar({ solo_activos: !this.verInactivos(), limite: 200 }).subscribe({
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
    this.descripcion = '';
    this.codigo = '';
    this.dialogoAbierto.set(true);
  }

  editar(tipo: TipoCuenta): void {
    this.editando.set(tipo);
    this.descripcion = tipo.descripcion;
    this.codigo = tipo.codigo;
    this.dialogoAbierto.set(true);
  }

  get valido(): boolean {
    return !!this.descripcion.trim() && !!this.codigo.trim();
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = { descripcion: this.descripcion.trim(), codigo: this.codigo.trim() };
    const peticion = enEdicion
      ? this.svc.actualizar(enEdicion.id, datos)
      : this.svc.crear(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoAbierto.set(false);
        this.msg.add({
          severity: 'success',
          summary: enEdicion ? 'Tipo actualizado' : 'Tipo creado',
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

  darDeBaja(tipo: TipoCuenta): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se dará de baja el tipo ${tipo.descripcion}. Las cuentas que ya lo usan lo conservan.`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(tipo.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Tipo dado de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
