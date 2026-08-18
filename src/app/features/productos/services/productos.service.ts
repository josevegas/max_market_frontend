import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';
import {
  Categoria,
  CategoriaCreate,
  CategoriaUpdate,
  Familia,
  FamiliaCreate,
  FamiliaUpdate,
  PrecioProducto,
  PrecioProductoCreate,
  Presentacion,
  PresentacionCreate,
  PresentacionUpdate,
  Producto,
  ProductoCreate,
  ProductoUpdate,
  SubCategoria,
  SubCategoriaCreate,
  SubCategoriaUpdate,
  SubFamilia,
  SubFamiliaCreate,
  SubFamiliaUpdate,
} from '../models/catalogo.model';
import { Pagina, RecursoService } from './catalogo.service';

@Injectable({ providedIn: 'root' })
export class FamiliaService extends RecursoService<Familia, FamiliaCreate, FamiliaUpdate> {
  protected readonly ruta = 'familias';
}

@Injectable({ providedIn: 'root' })
export class SubFamiliaService extends RecursoService<
  SubFamilia,
  SubFamiliaCreate,
  SubFamiliaUpdate
> {
  protected readonly ruta = 'sub-familias';
}

@Injectable({ providedIn: 'root' })
export class CategoriaService extends RecursoService<
  Categoria,
  CategoriaCreate,
  CategoriaUpdate
> {
  protected readonly ruta = 'categorias';
}

@Injectable({ providedIn: 'root' })
export class SubCategoriaService extends RecursoService<
  SubCategoria,
  SubCategoriaCreate,
  SubCategoriaUpdate
> {
  protected readonly ruta = 'sub-categorias';
}

@Injectable({ providedIn: 'root' })
export class PresentacionService extends RecursoService<
  Presentacion,
  PresentacionCreate,
  PresentacionUpdate
> {
  protected readonly ruta = 'presentaciones';
}

@Injectable({ providedIn: 'root' })
export class ProductoService extends RecursoService<Producto, ProductoCreate, ProductoUpdate> {
  protected readonly ruta = 'productos';

  /** El SKU es el identificador con el que trabaja el negocio. */
  obtenerPorSku(sku: string): Observable<Producto> {
    return this.api.get<Producto>(`${this.ruta}/sku/${sku}`);
  }

  precios(productoId: string): Observable<PrecioProducto[]> {
    return this.api
      .get<Pagina<PrecioProducto>>(`${this.ruta}/${productoId}/precios`)
      .pipe(map((pagina) => pagina.items));
  }

  precioVigente(productoId: string): Observable<PrecioProducto> {
    return this.api.get<PrecioProducto>(`${this.ruta}/${productoId}/precio-vigente`);
  }
}

@Injectable({ providedIn: 'root' })
export class PrecioService {
  private readonly api = inject(ApiClient);

  crear(datos: PrecioProductoCreate): Observable<PrecioProducto> {
    return this.api.post<PrecioProducto>('precios', datos);
  }
}
