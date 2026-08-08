import { Component, EventEmitter, Output, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface ItemMenu {
  etiqueta: string;
  icono: string;
  ruta: string;
}

interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  readonly abierto = input(true);
  @Output() linkClick = new EventEmitter<void>();

  /** Menú estático: el maestro de productos es lo único que hay por ahora.
   *  El orden sigue la jerarquía del catálogo, de lo general a lo particular. */
  readonly menu: GrupoMenu[] = [
    {
      titulo: 'Maestro de productos',
      items: [
        { etiqueta: 'Productos', icono: 'pi-box', ruta: '/productos' },
        { etiqueta: 'Familias', icono: 'pi-sitemap', ruta: '/familias' },
        { etiqueta: 'Sub familias', icono: 'pi-share-alt', ruta: '/sub-familias' },
        { etiqueta: 'Categorías', icono: 'pi-tags', ruta: '/categorias' },
        { etiqueta: 'Sub categorías', icono: 'pi-tag', ruta: '/sub-categorias' },
        { etiqueta: 'Presentaciones', icono: 'pi-inbox', ruta: '/presentaciones' },
      ],
    },
    {
      titulo: 'Proveedores',
      items: [{ etiqueta: 'Empresas', icono: 'pi-building', ruta: '/empresas' }],
    },
  ];
}
