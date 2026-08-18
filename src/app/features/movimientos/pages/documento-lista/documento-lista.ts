import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
import { Almacen } from '../../../almacenes/models/almacenes.model';
import { AlmacenService } from '../../../almacenes/services/almacenes.service';
import { DocumentoCabecera, Estado } from '../../models/movimientos.model';
import { Empresa } from '../../../proveedores/models/catalogo.model';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../models/tipos-documento';
import {
  ClaveDocumento,
  EmpresaService,
  EstadoService,
  RegistroDocumentos,
} from '../../services/movimientos.service';

/** Lista de cualquiera de los cinco documentos.
 *
 * Cuál se muestra lo dice `data.clave` de la ruta; el resto sale del
 * descriptor. Ver `tipos-documento.ts`.
 */
@Component({
  standalone: true,
  selector: 'app-documento-lista',
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
  templateUrl: './documento-lista.html',
})
export class DocumentoLista implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registro = inject(RegistroDocumentos);
  private readonly estados = inject(EstadoService);
  private readonly almacenes = inject(AlmacenService);
  private readonly empresas = inject(EmpresaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly tipo = signal<TipoDocumento>(TIPOS_DOCUMENTO.requerimientos);
  readonly cargando = signal(false);
  readonly items = signal<DocumentoCabecera[]>([]);
  readonly estadosLista = signal<Estado[]>([]);
  readonly origenLista = signal<{ id: string; etiqueta: string }[]>([]);
  readonly proveedores = signal<Empresa[]>([]);
  readonly verInactivos = signal(false);

  readonly descripcionEstado = computed(
    () => new Map(this.estadosLista().map((e) => [e.id, e.descripcion])),
  );
  readonly etiquetaOrigen = computed(
    () => new Map(this.origenLista().map((o) => [o.id, o.etiqueta])),
  );
  readonly nombreProveedor = computed(
    () => new Map(this.proveedores().map((p) => [p.id, p.razon_social])),
  );

  readonly estadoFiltro = signal<string | null>(null);
  readonly busqueda = signal('');

  readonly filtrados = computed(() => {
    const estado = this.estadoFiltro();
    const q = this.busqueda().trim().toLowerCase();
    const origenes = this.etiquetaOrigen();
    const campo = this.tipo().origen.campo;
    return this.items().filter((d) => {
      if (estado && d.estado_id !== estado) return false;
      if (!q) return true;
      const origen = origenes.get(String(d[campo] ?? '')) ?? '';
      return origen.toLowerCase().includes(q) || d.fecha.includes(q);
    });
  });

  ngOnInit(): void {
    // La clave viaja en la ruta, así que hay que reaccionar a sus cambios: al
    // pasar de "pedidos" a "cotizaciones" Angular reutiliza el componente y
    // ngOnInit no se vuelve a ejecutar.
    this.ruta.data.subscribe((data) => {
      this.tipo.set(TIPOS_DOCUMENTO[data['clave'] as ClaveDocumento]);
      this.estadoFiltro.set(null);
      this.busqueda.set('');
      this.cargar();
      this.cargarOrigen();
    });

    this.estados.listar({ limite: 200 }).subscribe({
      next: (e) => this.estadosLista.set(e),
      error: () => this.estadosLista.set([]),
    });
    this.empresas.listar({ limite: 500, es_proveedor: true }).subscribe({
      next: (p) => this.proveedores.set(p),
      error: () => this.proveedores.set([]),
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.registro
      .cabecera(this.tipo().clave)
      .listar({ solo_activos: !this.verInactivos(), limite: 500 })
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

  /** Opciones del documento de origen, para poder mostrar de qué nace cada
   * fila sin pedir un endpoint por registro. */
  private cargarOrigen(): void {
    const fuente = this.tipo().origen.fuente;
    if (fuente === 'almacenes') {
      this.almacenes.listar({ limite: 500 }).subscribe({
        next: (as: Almacen[]) =>
          this.origenLista.set(as.map((a) => ({ id: a.id, etiqueta: a.nombre }))),
        error: () => this.origenLista.set([]),
      });
      return;
    }
    this.registro
      .cabecera(fuente)
      .listar({ limite: 500 })
      .subscribe({
        next: (docs) =>
          this.origenLista.set(
            docs.map((d) => ({ id: d.id, etiqueta: this.rotularDocumento(d) })),
          ),
        error: () => this.origenLista.set([]),
      });
  }

  /** Los documentos no tienen número propio, así que se los identifica por su
   * fecha y el final de su id. */
  private rotularDocumento(d: DocumentoCabecera): string {
    return `${d.fecha} · ${d.id.slice(0, 8)}`;
  }

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  nuevo(): void {
    this.router.navigate(['/', this.tipo().clave, 'nuevo']);
  }

  editar(d: DocumentoCabecera): void {
    this.router.navigate(['/', this.tipo().clave, d.id]);
  }

  darDeBaja(d: DocumentoCabecera): void {
    const t = this.tipo();
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se dará de baja ${t.articulo} ${t.singular} del ${d.fecha}. Seguirá visible activando "ver inactivos".`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.registro
          .cabecera(t.clave)
          .desactivar(d.id)
          .subscribe({
            next: () => {
              this.msg.add({ severity: 'success', summary: 'Dado de baja', life: 2500 });
              this.cargar();
            },
            error: (e: AppError) =>
              this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
          }),
    });
  }
}
