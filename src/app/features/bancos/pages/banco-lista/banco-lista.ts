import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Banco, BancoCreate, LARGO_RUC } from '../../models/bancos.model';
import { BancoService } from '../../services/bancos.service';

/** Maestro de bancos. Es de quién dependen las cuentas, así que se administra
 * antes que ellas. */
@Component({
  standalone: true,
  selector: 'app-banco-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './banco-lista.html',
})
export class BancoLista implements OnInit {
  private readonly svc = inject(BancoService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Banco[]>([]);
  readonly verInactivos = signal(false);

  readonly busqueda = signal('');
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (b) =>
        b.razon_social.toLowerCase().includes(q) ||
        b.ruc.includes(q) ||
        (b.codigo ?? '').toLowerCase().includes(q),
    );
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Banco | null>(null);
  form: BancoCreate = this.formVacio();

  ngOnInit(): void {
    this.cargar();
  }

  private formVacio(): BancoCreate {
    return { razon_social: '', ruc: '', direccion: null, telefono: null, codigo: null };
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

  nuevo(): void {
    this.editando.set(null);
    this.form = this.formVacio();
    this.dialogoAbierto.set(true);
  }

  editar(banco: Banco): void {
    this.editando.set(banco);
    this.form = {
      razon_social: banco.razon_social,
      ruc: banco.ruc,
      direccion: banco.direccion,
      telefono: banco.telefono,
      codigo: banco.codigo,
    };
    this.dialogoAbierto.set(true);
  }

  /** La API exige 11 dígitos numéricos; validarlo acá evita un 422 que el
   *  usuario recibiría recién al guardar. */
  get rucValido(): boolean {
    const v = this.form.ruc.trim();
    return v.length === LARGO_RUC && /^\d+$/.test(v);
  }

  get valido(): boolean {
    return !!this.form.razon_social.trim() && this.rucValido;
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    // Los opcionales vacíos van como null: con la cadena vacía la API los
    // guardaría como texto en blanco en vez de "sin dato".
    const datos: BancoCreate = {
      razon_social: this.form.razon_social.trim(),
      ruc: this.form.ruc.trim(),
      direccion: this.form.direccion?.trim() || null,
      telefono: this.form.telefono?.trim() || null,
      codigo: this.form.codigo?.trim() || null,
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
          summary: enEdicion ? 'Banco actualizado' : 'Banco creado',
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

  darDeBaja(banco: Banco): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message:
        `Se dará de baja el banco ${banco.razon_social}. Sus cuentas no se borran, ` +
        'pero quedan colgando de un registro inactivo.',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(banco.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Banco dado de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
