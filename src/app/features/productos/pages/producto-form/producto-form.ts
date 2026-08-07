import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AppError } from '../../../../core/http/api-error';
import {
  Categoria,
  Familia,
  Presentacion,
  Producto,
  ProductoCreate,
  SubCategoria,
  SubFamilia,
} from '../../models/catalogo.model';
import {
  CategoriaService,
  FamiliaService,
  PresentacionService,
  ProductoService,
  SubCategoriaService,
  SubFamiliaService,
} from '../../services/productos.service';

/** Los tipos que admite el modelo (`tipo_producto`, 20 caracteres). */
const TIPOS = [
  { label: 'Producto Terminado', value: 'terminado' },
  { label: 'Insumo', value: 'insumo' },
  { label: 'Producto Elaborado', value: 'elaborado' },
];

@Component({
  standalone: true,
  selector: 'app-producto-form',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TagModule,
  ],
  templateUrl: './producto-form.html',
})
export class ProductoForm implements OnInit {
  private readonly svc = inject(ProductoService);
  private readonly familiaSvc = inject(FamiliaService);
  private readonly subFamiliaSvc = inject(SubFamiliaService);
  private readonly categoriaSvc = inject(CategoriaService);
  private readonly subCategoriaSvc = inject(SubCategoriaService);
  private readonly presentacionSvc = inject(PresentacionService);
  private readonly msg = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tipos = TIPOS;
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly producto = signal<Producto | null>(null);
  readonly esNuevo = computed(() => this.producto() === null);

  // Catálogos para los selectores
  readonly familias = signal<Familia[]>([]);
  readonly subFamilias = signal<SubFamilia[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly subCategorias = signal<SubCategoria[]>([]);
  readonly presentaciones = signal<Presentacion[]>([]);

  /** Las listas se encadenan: al elegir familia solo se ofrecen sus sub
   *  familias, y así hasta la sub categoría. Evita combinaciones imposibles. */
  readonly subFamiliasDeLaFamilia = computed(() =>
    this.subFamilias().filter((sf) => sf.familia_id === this.form.familia_id),
  );
  readonly categoriasDeLaSubFamilia = computed(() =>
    this.categorias().filter((c) => c.sub_familia_id === this.form.sub_familia_id),
  );
  readonly subCategoriasDeLaCategoria = computed(() =>
    this.subCategorias().filter((sc) => sc.categoria_id === this.form.categoria_id),
  );

  form: ProductoCreate = this.formVacio();

  ngOnInit(): void {
    this.cargarCatalogos();
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'nuevo') this.cargar(id);
  }

  private formVacio(): ProductoCreate {
    return {
      tipo_producto: 'bien',
      sku: '',
      codigo_barras: null,
      descripcion_corta: '',
      descripcion_legal: '',
      descripcion_compra: '',
      descripcion_web: '',
      familia_id: '',
      sub_familia_id: '',
      categoria_id: '',
      sub_categoria_id: null,
      presentacion_id: null,
    };
  }

  private cargarCatalogos(): void {
    const p = { limite: 500 };
    this.familiaSvc.listar(p).subscribe({ next: (x) => this.familias.set(x) });
    this.subFamiliaSvc.listar(p).subscribe({ next: (x) => this.subFamilias.set(x) });
    this.categoriaSvc.listar(p).subscribe({ next: (x) => this.categorias.set(x) });
    this.subCategoriaSvc.listar(p).subscribe({ next: (x) => this.subCategorias.set(x) });
    this.presentacionSvc.listar(p).subscribe({ next: (x) => this.presentaciones.set(x) });
  }

  private cargar(id: string): void {
    this.cargando.set(true);
    this.svc.obtener(id).subscribe({
      next: (p) => {
        this.producto.set(p);
        this.form = {
          tipo_producto: p.tipo_producto,
          sku: p.sku,
          codigo_barras: p.codigo_barras,
          descripcion_corta: p.descripcion_corta,
          descripcion_legal: p.descripcion_legal,
          descripcion_compra: p.descripcion_compra,
          descripcion_web: p.descripcion_web,
          familia_id: p.familia_id,
          sub_familia_id: p.sub_familia_id,
          categoria_id: p.categoria_id,
          sub_categoria_id: p.sub_categoria_id,
          presentacion_id: p.presentacion_id,
        };
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message });
      },
    });
  }

  /** Al cambiar un nivel se limpian los de abajo: si no, quedaría una sub
   *  familia que ya no pertenece a la familia elegida. */
  alCambiarFamilia(): void {
    this.form.sub_familia_id = '';
    this.form.categoria_id = '';
    this.form.sub_categoria_id = null;
  }

  alCambiarSubFamilia(): void {
    this.form.categoria_id = '';
    this.form.sub_categoria_id = null;
  }

  alCambiarCategoria(): void {
    this.form.sub_categoria_id = null;
  }

  get valido(): boolean {
    const f = this.form;
    return !!(
      f.sku.trim() &&
      f.tipo_producto &&
      f.descripcion_corta.trim() &&
      f.descripcion_legal.trim() &&
      f.descripcion_compra.trim() &&
      f.descripcion_web.trim() &&
      f.familia_id &&
      f.sub_familia_id &&
      f.categoria_id
    );
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const actual = this.producto();
    const peticion = actual
      ? this.svc.actualizar(actual.id, this.form)
      : this.svc.crear(this.form);

    peticion.subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.msg.add({
          severity: 'success',
          summary: actual ? 'Producto actualizado' : 'Producto creado',
          life: 2500,
        });
        if (!actual) this.router.navigate(['/productos', p.id]);
        else this.producto.set(p);
      },
      error: (e: AppError) => {
        this.guardando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: e.message });
      },
    });
  }

  volver(): void {
    this.router.navigate(['/productos']);
  }
}
