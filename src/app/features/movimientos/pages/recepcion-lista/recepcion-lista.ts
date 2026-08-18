import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { Estado, GuiaRemision, Recepcion } from '../../models/movimientos.model';
import {
  EstadoService,
  GuiaRemisionService,
  RecepcionService,
} from '../../services/movimientos.service';

/** Las recepciones registradas: qué entró, a qué almacén y contra qué papel. */
@Component({
  standalone: true,
  selector: 'app-recepcion-lista',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './recepcion-lista.html',
})
export class RecepcionLista implements OnInit {
  private readonly svc = inject(RecepcionService);
  private readonly guiaSvc = inject(GuiaRemisionService);
  private readonly almacenSvc = inject(AlmacenService);
  private readonly estadoSvc = inject(EstadoService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly items = signal<Recepcion[]>([]);
  readonly verInactivas = signal(false);

  readonly almacenes = signal<Almacen[]>([]);
  readonly estados = signal<Estado[]>([]);
  readonly guias = signal<GuiaRemision[]>([]);

  readonly nombreAlmacen = computed(
    () => new Map(this.almacenes().map((a) => [a.id, a.nombre])),
  );
  readonly nombreEstado = computed(
    () => new Map(this.estados().map((e) => [e.id, e.descripcion])),
  );
  /** La guía no tiene número propio en la API, así que se la identifica por su
   * fecha y los primeros dígitos del id, igual que en el resto del módulo. */
  readonly etiquetaGuia = computed(
    () => new Map(this.guias().map((g) => [g.id, `${g.fecha} · ${g.id.slice(0, 8)}`])),
  );

  readonly almacenFiltro = signal<string | null>(null);
  readonly busqueda = signal('');

  readonly filtradas = computed(() => {
    const almacen = this.almacenFiltro();
    const q = this.busqueda().trim().toLowerCase();
    return this.items().filter((r) => {
      if (almacen && r.almacen_id !== almacen) return false;
      if (!q) return true;
      const texto = [
        r.fecha,
        r.observaciones ?? '',
        this.nombreAlmacen().get(r.almacen_id) ?? '',
        r.guia_remision_id ? this.etiquetaGuia().get(r.guia_remision_id) ?? '' : '',
      ]
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  });

  ngOnInit(): void {
    this.cargar();
    this.almacenSvc.listarTodo().subscribe({ next: (a) => this.almacenes.set(a) });
    this.estadoSvc.listar({ limite: 200 }).subscribe({ next: (e) => this.estados.set(e) });
    this.guiaSvc.listarTodo().subscribe({ next: (g) => this.guias.set(g) });
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.listarTodo({ solo_activos: !this.verInactivas() }).subscribe({
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

  alternarInactivas(): void {
    this.verInactivas.update((v) => !v);
    this.cargar();
  }

  /** Contra qué papel se recibió. La recepción cuelga de una guía o, cuando el
   * proveedor entregó sin guía previa, directamente de la orden de compra. */
  origenDe(r: Recepcion): string {
    if (r.guia_remision_id) {
      return this.etiquetaGuia().get(r.guia_remision_id) ?? r.guia_remision_id.slice(0, 8);
    }
    if (r.orden_compra_id) return `OC ${r.orden_compra_id.slice(0, 8)}`;
    return '—';
  }

  abrir(r: Recepcion): void {
    this.router.navigate(['/recepciones', r.id]);
  }

  darDeBaja(r: Recepcion): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message:
        `Se dará de baja la recepción del ${r.fecha}. Es una baja lógica: la fila se ` +
        'conserva. Ojo: los estados que la recepción arrastró en la cadena no vuelven atrás.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(r.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Recepción dada de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
