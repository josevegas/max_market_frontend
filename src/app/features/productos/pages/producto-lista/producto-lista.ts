import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Categoria, Familia, Producto } from '../../models/catalogo.model';
import {
  CategoriaService,
  FamiliaService,
  ProductoService,
} from '../../services/productos.service';

@Component({
  standalone: true,
  selector: 'app-producto-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './producto-lista.html',
})
export class ProductoLista implements OnInit {
  private readonly svc = inject(ProductoService);
  private readonly familiaSvc = inject(FamiliaService);
  private readonly categoriaSvc = inject(CategoriaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly items = signal<Producto[]>([]);
  readonly verInactivos = signal(false);

  readonly familias = signal<Familia[]>([]);
  readonly categorias = signal<Categoria[]>([]);

  /** Los filtros de familia y categoría los aplica el servidor (la API los
   *  acepta como query params); el texto se filtra en cliente. */
  familiaId: string | null = null;
  categoriaId: string | null = null;

  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.descripcion_corta.toLowerCase().includes(q) ||
        (p.codigo_barras ?? '').toLowerCase().includes(q),
    );
  });

  readonly nombreFamilia = computed(() => {
    const mapa = new Map<string, string>();
    for (const f of this.familias()) mapa.set(f.id, f.nombre);
    return mapa;
  });
  readonly nombreCategoria = computed(() => {
    const mapa = new Map<string, string>();
    for (const c of this.categorias()) mapa.set(c.id, c.nombre);
    return mapa;
  });

  ngOnInit(): void {
    this.familiaSvc.listar({ limite: 500 }).subscribe({
      next: (items) => this.familias.set(items),
    });
    this.categoriaSvc.listar({ limite: 500 }).subscribe({
      next: (items) => this.categorias.set(items),
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc
      .listar({
        solo_activos: !this.verInactivos(),
        limite: 500,
        familia_id: this.familiaId,
        categoria_id: this.categoriaId,
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

  limpiarFiltros(): void {
    this.familiaId = null;
    this.categoriaId = null;
    this.busqueda.set('');
    this.cargar();
  }

  nuevo(): void {
    this.router.navigate(['/productos/nuevo']);
  }

  editar(producto: Producto): void {
    this.router.navigate(['/productos', producto.id]);
  }

  darDeBaja(producto: Producto): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: 'Se dará de baja el producto ' + producto.sku + '.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(producto.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Producto dado de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
