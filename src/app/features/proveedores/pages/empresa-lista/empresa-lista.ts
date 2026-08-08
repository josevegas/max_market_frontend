import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Empresa } from '../../models/catalogo.model';
import { EmpresaService } from '../../services/empresas.service';

@Component({
  standalone: true,
  selector: 'app-empresa-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './empresa-lista.html',
})
export class EmpresaLista implements OnInit {
  private readonly svc = inject(EmpresaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly items = signal<Empresa[]>([]);
  readonly verInactivos = signal(false);
  /** El backend filtra por `es_proveedor`; solo se envía cuando está activo,
   *  porque `false` traería únicamente las no proveedoras. */
  readonly soloProveedores = signal(false);

  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (p) =>
        p.razon_social.toLowerCase().includes(q) ||
        p.ruc.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc
      .listar({
        solo_activos: !this.verInactivos(),
        limite: 500,
        es_proveedor: this.soloProveedores() ? true : null,
      })
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

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  alternarProveedores(): void {
    this.soloProveedores.update((v) => !v);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.soloProveedores.set(false);
    this.cargar();
  }

  darDeBaja(empresa: Empresa): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: 'Se dará de baja la empresa ' + empresa.razon_social + '.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(empresa.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Empresa dada de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
