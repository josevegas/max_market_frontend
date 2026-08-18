import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { Almacen, Market } from '../../models/almacenes.model';
import { AlmacenService, MarketService } from '../../services/almacenes.service';

@Component({
  standalone: true,
  selector: 'app-almacen-lista',
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
  templateUrl: './almacen-lista.html',
})
export class AlmacenLista implements OnInit {
  private readonly svc = inject(AlmacenService);
  private readonly markets = inject(MarketService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Almacen[]>([]);
  readonly marketsLista = signal<Market[]>([]);
  readonly verInactivos = signal(false);

  /** Nombre del market por id, para no repetir la búsqueda en cada fila. */
  readonly nombreMarket = computed(
    () => new Map(this.marketsLista().map((m) => [m.id, m.nombre])),
  );

  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (a) => a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Almacen | null>(null);
  nombre = '';
  codigo = '';
  marketId: string | null = null;

  ngOnInit(): void {
    this.cargar();
    this.markets.listar({ limite: 500 }).subscribe({
      next: (m) => this.marketsLista.set(m),
      error: (e: AppError) =>
        this.msg.add({ severity: 'error', summary: 'No se pudieron cargar los markets', detail: e.message }),
    });
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

  nuevo(): void {
    this.editando.set(null);
    this.nombre = '';
    this.codigo = '';
    this.marketId = null;
    this.dialogoAbierto.set(true);
  }

  editar(almacen: Almacen): void {
    this.editando.set(almacen);
    this.nombre = almacen.nombre;
    this.codigo = almacen.codigo;
    this.marketId = almacen.market_id;
    this.dialogoAbierto.set(true);
  }

  get valido(): boolean {
    return !!this.nombre.trim() && !!this.codigo.trim() && !!this.marketId;
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = {
      market_id: this.marketId!,
      nombre: this.nombre.trim(),
      codigo: this.codigo.trim(),
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
          summary: enEdicion ? 'Almacén actualizado' : 'Almacén creado',
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

  darDeBaja(almacen: Almacen): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se dará de baja el almacén ${almacen.nombre}. Seguirá visible activando "ver inactivos".`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(almacen.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Almacén dado de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
