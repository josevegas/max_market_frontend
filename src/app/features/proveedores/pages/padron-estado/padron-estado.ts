import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AppError } from '../../../../core/http/api-error';
import { EstadoPadron } from '../../models/catalogo.model';
import { PadronService } from '../../services/padron.service';

/** Estado del padrón de agentes de retención y percepción.
 *
 * De acá salen `es_ag_retencion` y `es_ag_percepcion` de cada empresa: la
 * consulta de RUC no informa esos datos. Con el padrón vacío toda empresa
 * nueva se registra como no agente, así que la pantalla existe sobre todo para
 * responder "¿esto está al día?" y para sembrarlo la primera vez.
 */
@Component({
  standalone: true,
  selector: 'app-padron-estado',
  imports: [CommonModule, ButtonModule, SkeletonModule, TagModule],
  templateUrl: './padron-estado.html',
})
export class PadronEstado implements OnInit {
  private readonly svc = inject(PadronService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly sincronizando = signal(false);
  readonly estado = signal<EstadoPadron | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.estado().subscribe({
      next: (e) => {
        this.estado.set(e);
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: e.message });
      },
    });
  }

  /** La fecha viaja como ISO del servidor; se muestra en hora local. */
  fecha(iso: string | null): string {
    if (!iso) return 'Nunca';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('es-PE');
  }

  sincronizar(): void {
    if (this.sincronizando()) return;

    this.confirm.confirm({
      header: 'Sincronizar el padrón',
      message:
        'Se reemplaza el padrón guardado con lo que publica SUNAT y se ' +
        'actualiza la condición de agente de todas las empresas. Tarda unos ' +
        'segundos: son dos descargas externas.',
      acceptLabel: 'Sincronizar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.sincronizando.set(true);
        this.svc.sincronizar().subscribe({
          next: (r) => {
            this.sincronizando.set(false);
            this.msg.add({
              severity: r.ok ? 'success' : 'warn',
              summary: r.ok ? 'Padrón sincronizado' : 'Sincronización con avisos',
              detail:
                `${r.filas_retencion} agentes de retención y ${r.filas_percepcion} ` +
                `de percepción. ${r.empresas_actualizadas} empresa(s) cambiaron.`,
              life: 6000,
            });
            this.cargar();
          },
          error: (e: AppError) => {
            this.sincronizando.set(false);
            this.msg.add({
              severity: 'error',
              summary: 'No se pudo sincronizar',
              detail: e.message,
            });
          },
        });
      },
    });
  }
}
