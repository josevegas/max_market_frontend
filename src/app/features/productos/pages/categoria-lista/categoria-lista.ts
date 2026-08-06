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
import { Categoria, SubFamilia } from '../../models/catalogo.model';
import { CategoriaService, SubFamiliaService } from '../../services/productos.service';

@Component({
  standalone: true,
  selector: 'app-categoria-lista',
  imports: [
    CommonModule, FormsModule, ButtonModule, DialogModule, IconFieldModule,
    InputIconModule, InputNumberModule, InputTextModule, SelectModule,
    TableModule, TagModule, ToggleSwitchModule,
  ],
  templateUrl: './categoria-lista.html',
})
export class CategoriaLista implements OnInit {
  private readonly svc = inject(CategoriaService);
  private readonly padreSvc = inject(SubFamiliaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Categoria[]>([]);
  readonly verInactivos = signal(false);

  /** Sub familia disponibles para el selector y para resolver el nombre en
   *  la tabla: la API devuelve el id, no el nombre. */
  readonly padres = signal<SubFamilia[]>([]);
  readonly nombrePadre = computed(() => {
    const mapa = new Map<string, string>();
    for (const p of this.padres()) mapa.set(p.id, p.nombre);
    return mapa;
  });

  readonly busqueda = signal('');
  readonly filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (x) => x.nombre.toLowerCase().includes(q) || (x.codigo ?? '').toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Categoria | null>(null);
  nombre = '';
  codigo = '';
  padreId: string | null = null;
  margen = 0;

  ngOnInit(): void {
    this.cargarPadres();
    this.cargar();
  }

  cargarPadres(): void {
    this.padreSvc.listar({ limite: 500 }).subscribe({
      next: (items) => this.padres.set(items),
      error: (e: AppError) =>
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
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

  nueva(): void {
    this.editando.set(null);
    this.nombre = '';
    this.codigo = '';
    this.padreId = null;
    this.margen = 0;
    this.dialogoAbierto.set(true);
  }

  editar(item: Categoria): void {
    this.editando.set(item);
    this.nombre = item.nombre;
    this.codigo = item.codigo ?? '';
    this.padreId = item.sub_familia_id;
    this.margen = Number(item.margen_ganancia);
    this.dialogoAbierto.set(true);
  }

  guardar(): void {
    if (!this.puedeGuardar() || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos = {
      nombre: this.nombre.trim(),
      codigo: this.codigo.trim() || null,
      sub_familia_id: this.padreId!,
      margen_ganancia: this.margen,
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
          summary: enEdicion ? 'Categoría actualizada' : 'Categoría creada',
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

  puedeGuardar(): boolean {
    return !!this.nombre.trim() && !!this.padreId && this.margen >= 0;
  }

  darDeBaja(item: Categoria): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: 'Se dará de baja ' + item.nombre + '. Seguirá visible activando "ver inactivos".',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(item.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Categoría dada de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
