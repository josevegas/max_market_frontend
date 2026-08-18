import { Component, EventEmitter, Output, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs/operators';

const CLAVE_GRUPOS = 'maxmarket.menu.colapsados';

interface ItemMenu {
  etiqueta: string;
  icono: string;
  ruta: string;
}

interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

/** Títulos plegados, tal como quedaron la última vez. */
function leerColapsados(): Set<string> {
  try {
    const guardado = localStorage.getItem(CLAVE_GRUPOS);
    return new Set<string>(guardado ? JSON.parse(guardado) : []);
  } catch {
    // Modo privado sin storage, o un valor corrupto: se arranca con todo
    // desplegado, que es el estado que no esconde nada.
    return new Set<string>();
  }
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

  private readonly router = inject(Router);

  private readonly colapsados = signal<Set<string>>(leerColapsados());

  /** Ruta activa, para no esconder dónde está parado el usuario. */
  private readonly urlActual = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** True si el grupo muestra sus items.
   *
   * Con la barra en modo riel se ignora el plegado: ahí no hay cabeceras que
   * tocar, así que un grupo plegado sería navegación inalcanzable. */
  desplegado(grupo: GrupoMenu): boolean {
    return !this.abierto() || !this.colapsados().has(grupo.titulo);
  }

  /** True si la pantalla actual vive en este grupo. Sirve para marcar la
   *  cabecera cuando está plegada y el item activo no se ve. */
  tieneRutaActiva(grupo: GrupoMenu): boolean {
    const url = this.urlActual();
    return grupo.items.some(
      (i) => url === i.ruta || url.startsWith(`${i.ruta}/`),
    );
  }

  alternarGrupo(titulo: string): void {
    const siguiente = new Set(this.colapsados());
    if (!siguiente.delete(titulo)) siguiente.add(titulo);
    this.colapsados.set(siguiente);
    try {
      localStorage.setItem(CLAVE_GRUPOS, JSON.stringify([...siguiente]));
    } catch {
      // Sin storage el plegado vale para esta sesión y no persiste.
    }
  }

  /** Menú estático. Dentro de cada grupo el orden sigue el del negocio: la
   *  jerarquía del catálogo de lo general a lo particular, y los movimientos
   *  en el orden en que se encadenan (requerimiento → pedido → cotización →
   *  orden de compra → guía). */
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
        { etiqueta: 'Unidades de medida', icono: 'pi-calculator', ruta: '/unidades-medida' },
      ],
    },
    {
      titulo: 'Proveedores',
      items: [
        { etiqueta: 'Empresas', icono: 'pi-building', ruta: '/empresas' },
        { etiqueta: 'Padrón de agentes', icono: 'pi-verified', ruta: '/padron-agentes' },
      ],
    },
    {
      titulo: 'Bancos',
      items: [
        { etiqueta: 'Bancos', icono: 'pi-briefcase', ruta: '/bancos' },
        { etiqueta: 'Tipos de cuenta', icono: 'pi-list', ruta: '/tipos-cuenta' },
        { etiqueta: 'Cuentas bancarias', icono: 'pi-credit-card', ruta: '/cuentas' },
      ],
    },
    {
      titulo: 'Organización',
      items: [
        { etiqueta: 'Zonas', icono: 'pi-map', ruta: '/zonas' },
        { etiqueta: 'Sedes', icono: 'pi-map-marker', ruta: '/sedes' },
        { etiqueta: 'Markets', icono: 'pi-shop', ruta: '/markets' },
      ],
    },
    {
      titulo: 'Almacenes',
      items: [
        { etiqueta: 'Almacenes', icono: 'pi-warehouse', ruta: '/almacenes' },
        { etiqueta: 'Stock por almacén', icono: 'pi-chart-bar', ruta: '/stock-almacen' },
        { etiqueta: 'Lotes', icono: 'pi-calendar-clock', ruta: '/lotes' },
      ],
    },
    {
      titulo: 'Movimientos',
      items: [
        { etiqueta: 'Requerimientos', icono: 'pi-file-edit', ruta: '/requerimientos' },
        { etiqueta: 'Pedidos', icono: 'pi-shopping-cart', ruta: '/pedidos' },
        { etiqueta: 'Cotizaciones', icono: 'pi-dollar', ruta: '/cotizaciones' },
        { etiqueta: 'Órdenes de compra', icono: 'pi-check-square', ruta: '/ordenes-compra' },
        { etiqueta: 'Guías de remisión', icono: 'pi-truck', ruta: '/guias-remision' },
        { etiqueta: 'Recepciones', icono: 'pi-inbox', ruta: '/recepciones' },
        { etiqueta: 'Estados', icono: 'pi-flag', ruta: '/estados' },
      ],
    },
  ];
}
