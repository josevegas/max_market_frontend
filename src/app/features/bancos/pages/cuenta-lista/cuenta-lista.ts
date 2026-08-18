import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { AppError } from '../../../../core/http/api-error';
import { Empresa } from '../../../proveedores/models/catalogo.model';
import {
  Banco,
  Cuenta,
  CuentaCreate,
  MONEDAS,
  TipoCuenta,
} from '../../models/bancos.model';
import {
  BancoService,
  CuentaService,
  EmpresaService,
  TipoCuentaService,
} from '../../services/bancos.service';

/** Cuentas bancarias de cada empresa.
 *
 * Es el cruce de los otros dos maestros con el de empresas, así que necesita
 * los tres cargados para poder mostrar nombres en vez de ids.
 */
@Component({
  standalone: true,
  selector: 'app-cuenta-lista',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './cuenta-lista.html',
})
export class CuentaLista implements OnInit {
  private readonly svc = inject(CuentaService);
  private readonly bancoSvc = inject(BancoService);
  private readonly tipoSvc = inject(TipoCuentaService);
  private readonly empresaSvc = inject(EmpresaService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly monedas = MONEDAS;

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly items = signal<Cuenta[]>([]);
  readonly verInactivos = signal(false);

  readonly bancos = signal<Banco[]>([]);
  readonly tipos = signal<TipoCuenta[]>([]);
  readonly empresas = signal<Empresa[]>([]);

  /** Mapas de id → nombre, para que la tabla no muestre UUIDs. */
  readonly nombreBanco = computed(
    () => new Map(this.bancos().map((b) => [b.id, b.razon_social])),
  );
  readonly nombreTipo = computed(
    () => new Map(this.tipos().map((t) => [t.id, t.descripcion])),
  );
  readonly nombreEmpresa = computed(
    () => new Map(this.empresas().map((e) => [e.id, e.razon_social])),
  );

  readonly busqueda = signal('');
  readonly empresaFiltro = signal<string | null>(null);
  readonly bancoFiltro = signal<string | null>(null);

  readonly filtrados = computed(() => {
    const empresa = this.empresaFiltro();
    const banco = this.bancoFiltro();
    const q = this.busqueda().trim().toLowerCase();
    return this.items().filter((c) => {
      if (empresa && c.empresa_id !== empresa) return false;
      if (banco && c.banco_id !== banco) return false;
      if (!q) return true;
      // Se busca también por el nombre resuelto: quien busca "Interbank" no
      // tiene por qué conocer el número de cuenta.
      const nombres = [
        this.nombreBanco().get(c.banco_id),
        this.nombreEmpresa().get(c.empresa_id),
      ]
        .join(' ')
        .toLowerCase();
      return c.numero_cuenta.toLowerCase().includes(q) || nombres.includes(q);
    });
  });

  readonly dialogoAbierto = signal(false);
  readonly editando = signal<Cuenta | null>(null);
  form: CuentaCreate = this.formVacio();

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  private formVacio(): CuentaCreate {
    return {
      numero_cuenta: '',
      banco_id: '',
      empresa_id: '',
      tipo_cuenta_id: '',
      moneda: 'PEN',
    };
  }

  cargar(): void {
    this.cargando.set(true);
    this.svc.listarTodo({ solo_activos: !this.verInactivos() }).subscribe({
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

  private cargarCatalogos(): void {
    this.bancoSvc.listarTodo().subscribe({ next: (b) => this.bancos.set(b) });
    this.tipoSvc.listarTodo().subscribe({ next: (t) => this.tipos.set(t) });
    this.empresaSvc.listarTodo().subscribe({ next: (e) => this.empresas.set(e) });
  }

  alternarInactivos(): void {
    this.verInactivos.update((v) => !v);
    this.cargar();
  }

  nuevo(): void {
    this.editando.set(null);
    this.form = this.formVacio();
    // Si la lista está filtrada, se proponen esos valores: cargar varias
    // cuentas de la misma empresa es lo normal.
    this.form.empresa_id = this.empresaFiltro() ?? '';
    this.form.banco_id = this.bancoFiltro() ?? '';
    this.dialogoAbierto.set(true);
  }

  editar(cuenta: Cuenta): void {
    this.editando.set(cuenta);
    this.form = {
      numero_cuenta: cuenta.numero_cuenta,
      banco_id: cuenta.banco_id,
      empresa_id: cuenta.empresa_id,
      tipo_cuenta_id: cuenta.tipo_cuenta_id,
      moneda: cuenta.moneda === 'USD' ? 'USD' : 'PEN',
    };
    this.dialogoAbierto.set(true);
  }

  get valido(): boolean {
    const f = this.form;
    return !!(
      f.numero_cuenta.trim() &&
      f.banco_id &&
      f.empresa_id &&
      f.tipo_cuenta_id &&
      f.moneda
    );
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const enEdicion = this.editando();
    const datos: CuentaCreate = { ...this.form, numero_cuenta: this.form.numero_cuenta.trim() };
    const peticion = enEdicion
      ? this.svc.actualizar(enEdicion.id, datos)
      : this.svc.crear(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoAbierto.set(false);
        this.msg.add({
          severity: 'success',
          summary: enEdicion ? 'Cuenta actualizada' : 'Cuenta creada',
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

  darDeBaja(cuenta: Cuenta): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message: `Se dará de baja la cuenta ${cuenta.numero_cuenta}. Es una baja lógica: la fila se conserva.`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.svc.desactivar(cuenta.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Cuenta dada de baja', life: 2500 });
            this.cargar();
          },
          error: (e: AppError) =>
            this.msg.add({ severity: 'error', summary: 'Error', detail: e.message }),
        }),
    });
  }
}
