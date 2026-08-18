import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { forkJoin, of, switchMap } from 'rxjs';

import { AppError } from '../../../../core/http/api-error';
import { Almacen, UnidadMedida } from '../../../almacenes/models/almacenes.model';
import {
  AlmacenService,
  UnidadMedidaService,
} from '../../../almacenes/services/almacenes.service';
import { Producto } from '../../../productos/models/catalogo.model';
import { ProductoService } from '../../../productos/services/productos.service';
import { CODIGO_APROBADO } from '../../models/codigos-estado';
import {
  DocumentoCabecera,
  DocumentoDetalle,
  Estado,
  LineaEditable,
} from '../../models/movimientos.model';
import { Empresa } from '../../../proveedores/models/catalogo.model';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../models/tipos-documento';
import {
  ClaveDocumento,
  EmpresaService,
  EstadoService,
  RegistroDocumentos,
} from '../../services/movimientos.service';

/** Editor de cualquiera de los cinco documentos: cabecera y líneas juntas.
 *
 * La API los guarda en dos recursos separados (`/pedidos` y
 * `/pedidos-detalle`), pero para quien opera es un solo documento: crear la
 * cabecera y después ir a otra pantalla a cargar las líneas no es una
 * operación que exista en el negocio. Acá se guarda todo en un botón.
 */
@Component({
  standalone: true,
  selector: 'app-documento-form',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
  ],
  templateUrl: './documento-form.html',
})
export class DocumentoForm implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registro = inject(RegistroDocumentos);
  private readonly estados = inject(EstadoService);
  private readonly almacenes = inject(AlmacenService);
  private readonly productos = inject(ProductoService);
  private readonly unidades = inject(UnidadMedidaService);
  private readonly empresas = inject(EmpresaService);
  private readonly msg = inject(MessageService);

  readonly tipo = signal<TipoDocumento>(TIPOS_DOCUMENTO.requerimientos);
  readonly documentoId = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  readonly estadosLista = signal<Estado[]>([]);
  readonly origenLista = signal<{ id: string; etiqueta: string }[]>([]);
  /** No hay ningún documento de origen aprobado: el selector queda vacío y sin
   * este aviso parecería que la lista no cargó. */
  readonly sinAprobados = signal(false);
  readonly productosLista = signal<Producto[]>([]);
  readonly unidadesLista = signal<UnidadMedida[]>([]);
  readonly proveedores = signal<Empresa[]>([]);

  // Cabecera
  origenId: string | null = null;
  estadoId: string | null = null;
  fecha: Date = new Date();
  proveedorId: string | null = null;
  tiempoAtencion = 0;

  // Detalle
  readonly lineas = signal<LineaEditable[]>([]);
  /** Ids de líneas que estaban guardadas y el usuario quitó. Se dan de baja al
   * guardar, no al quitarlas: mientras no se confirme, cancelar debe dejar el
   * documento como estaba. */
  private readonly lineasEliminadas = signal<string[]>([]);

  readonly esNuevo = computed(() => this.documentoId() === null);

  /** True cuando el selector de origen está mostrando solo los aprobados. El
   * requerimiento cuelga de un almacén, no de un documento, y en edición no se
   * filtra (ver `cargarOrigen`). */
  readonly filtraPorAprobado = computed(
    () => this.esNuevo() && this.tipo().origen.fuente !== 'almacenes',
  );

  readonly total = computed(() =>
    this.lineas().reduce(
      (suma, l) => suma + (l.cantidad || 0) * (l.precio_unitario || 0),
      0,
    ),
  );

  readonly nombreProducto = computed(
    () => new Map(this.productosLista().map((p) => [p.id, p.descripcion_corta])),
  );

  ngOnInit(): void {
    const clave = this.ruta.snapshot.data['clave'] as ClaveDocumento;
    const tipo = TIPOS_DOCUMENTO[clave];
    this.tipo.set(tipo);

    const id = this.ruta.snapshot.params['id'] as string | undefined;
    this.documentoId.set(id ?? null);

    this.productos.listarTodo().subscribe({
      next: (p) => this.productosLista.set(p),
      error: () => this.productosLista.set([]),
    });
    this.unidades.listar({ limite: 500 }).subscribe({
      next: (u) => this.unidadesLista.set(u),
      error: () => this.unidadesLista.set([]),
    });
    if (tipo.conProveedor) {
      this.empresas.listar({ limite: 500, es_proveedor: true }).subscribe({
        next: (p) => this.proveedores.set(p),
        error: () => this.proveedores.set([]),
      });
    }
    // Los estados van antes que el origen: el selector solo debe ofrecer
    // documentos aprobados, y para saber cuáles lo están hay que resolver qué
    // id tiene el código `APR`.
    this.estados.listar({ limite: 200 }).subscribe({
      next: (e) => {
        this.estadosLista.set(e);
        this.cargarOrigen(tipo, !id);
      },
      error: () => {
        this.estadosLista.set([]);
        this.cargarOrigen(tipo, !id);
      },
    });

    if (id) this.cargarDocumento(tipo, id);
  }

  /** Id del estado `APR`, o `null` si el catálogo no lo tiene todavía. */
  private get idAprobado(): string | null {
    return this.estadosLista().find((e) => e.codigo === CODIGO_APROBADO)?.id ?? null;
  }

  /** Carga las opciones del selector de origen.
   *
   * `soloAprobados` va en alta pero no en edición: un documento ya guardado
   * puede colgar de un padre que entretanto pasó a `ATENDIDO`, y filtrarlo
   * dejaría el selector en blanco como si el dato se hubiera perdido.
   */
  private cargarOrigen(tipo: TipoDocumento, soloAprobados: boolean): void {
    if (tipo.origen.fuente === 'almacenes') {
      this.almacenes.listar({ limite: 500 }).subscribe({
        next: (as: Almacen[]) =>
          this.origenLista.set(as.map((a) => ({ id: a.id, etiqueta: a.nombre }))),
        error: () => this.origenLista.set([]),
      });
      return;
    }
    // Filtrar acá y no dejar que conteste el servidor: la API rechaza con 409
    // crear un documento contra un padre que no está aprobado, y ese error
    // llega recién después de haber cargado todas las líneas.
    const aprobado = soloAprobados ? this.idAprobado : null;
    this.registro
      .cabecera(tipo.origen.fuente)
      .listar({ limite: 500 })
      .subscribe({
        next: (docs) => {
          // Sin el estado `APR` en el catálogo no hay con qué filtrar; se
          // ofrecen todos antes que dejar el selector vacío sin explicación.
          const candidatos = aprobado
            ? docs.filter((d) => d.estado_id === aprobado)
            : docs;
          this.sinAprobados.set(!!aprobado && candidatos.length === 0);
          this.origenLista.set(
            candidatos.map((d) => ({
              id: d.id,
              etiqueta: `${d.fecha} · ${d.id.slice(0, 8)}`,
            })),
          );
        },
        error: () => this.origenLista.set([]),
      });
  }

  private cargarDocumento(tipo: TipoDocumento, id: string): void {
    this.cargando.set(true);
    forkJoin({
      cabecera: this.registro.cabecera(tipo.clave).obtener(id),
      detalle: this.registro
        .detalle(tipo.clave)
        .listar({ [tipo.campoPadre]: id, limite: 500 }),
    }).subscribe({
      next: ({ cabecera, detalle }) => {
        this.origenId = String(cabecera[tipo.origen.campo] ?? '') || null;
        this.estadoId = cabecera.estado_id;
        this.fecha = new Date(`${cabecera.fecha}T00:00:00`);
        if (tipo.conProveedor) {
          this.proveedorId = cabecera.proveedor_id ?? null;
          this.tiempoAtencion = cabecera.tiempo_atencion ?? 0;
        }
        this.lineas.set(
          detalle.map((d: DocumentoDetalle) => ({
            id: d.id,
            producto_id: d.producto_id,
            unidad_medida_id: d.unidad_medida_id,
            cantidad: d.cantidad,
            precio_unitario: Number(d.precio_unitario ?? 0),
          })),
        );
        this.cargando.set(false);
      },
      error: (e: AppError) => {
        this.cargando.set(false);
        this.msg.add({ severity: 'error', summary: 'No se pudo cargar', detail: e.message });
      },
    });
  }

  agregarLinea(): void {
    this.lineas.update((ls) => [
      ...ls,
      {
        producto_id: null,
        unidad_medida_id: null,
        cantidad: this.tipo().cantidadMinima || 1,
        precio_unitario: 0,
      },
    ]);
  }

  quitarLinea(indice: number): void {
    const linea = this.lineas()[indice];
    if (linea?.id) this.lineasEliminadas.update((ids) => [...ids, linea.id!]);
    this.lineas.update((ls) => ls.filter((_, i) => i !== indice));
  }

  /** Al elegir el producto se propone su unidad si el producto la tiene; el
   * operador puede cambiarla. Evita tener que elegir dos veces lo mismo. */
  alCambiarProducto(linea: LineaEditable): void {
    if (linea.unidad_medida_id) return;
    const unica = this.unidadesLista();
    if (unica.length === 1) linea.unidad_medida_id = unica[0].id;
  }

  get errorCabecera(): string | null {
    const t = this.tipo();
    if (!this.origenId) return `Seleccione ${t.origen.etiqueta.toLowerCase()}`;
    if (!this.estadoId) return 'Seleccione el estado';
    if (!this.fecha) return 'Indique la fecha';
    if (t.conProveedor && !this.proveedorId) return 'Seleccione el proveedor';
    return null;
  }

  get errorLineas(): string | null {
    const ls = this.lineas();
    if (!ls.length) return 'Agregue al menos una línea';
    const minimo = this.tipo().cantidadMinima;
    for (const [i, l] of ls.entries()) {
      if (!l.producto_id) return `Línea ${i + 1}: falta el producto`;
      if (!l.unidad_medida_id) return `Línea ${i + 1}: falta la unidad`;
      if (l.cantidad < minimo) return `Línea ${i + 1}: la cantidad mínima es ${minimo}`;
      if (this.tipo().conPrecio && l.precio_unitario < 0) {
        return `Línea ${i + 1}: el precio no puede ser negativo`;
      }
    }
    return null;
  }

  get valido(): boolean {
    return !this.errorCabecera && !this.errorLineas;
  }

  private cuerpoCabecera(): Record<string, unknown> {
    const t = this.tipo();
    const cuerpo: Record<string, unknown> = {
      [t.origen.campo]: this.origenId,
      estado_id: this.estadoId,
      fecha: this.aIso(this.fecha),
    };
    if (t.conProveedor) {
      cuerpo['proveedor_id'] = this.proveedorId;
      cuerpo['tiempo_atencion'] = this.tiempoAtencion;
    }
    return cuerpo;
  }

  /** `YYYY-MM-DD` en hora local. `toISOString()` pasa por UTC y en Perú
   * (UTC-5) devuelve el día anterior para cualquier fecha del día. */
  private aIso(fecha: Date): string {
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private cuerpoLinea(linea: LineaEditable, padreId: string): Record<string, unknown> {
    const t = this.tipo();
    const cuerpo: Record<string, unknown> = {
      [t.campoPadre]: padreId,
      producto_id: linea.producto_id,
      unidad_medida_id: linea.unidad_medida_id,
      cantidad: linea.cantidad,
    };
    // El importe de la línea lo calcula el servidor; mandarlo permitiría un
    // total que no cuadra con cantidad × precio.
    if (t.conPrecio) cuerpo['precio_unitario'] = linea.precio_unitario;
    return cuerpo;
  }

  guardar(): void {
    if (!this.valido || this.guardando()) return;
    this.guardando.set(true);

    const t = this.tipo();
    const cabeceras = this.registro.cabecera(t.clave);
    const detalles = this.registro.detalle(t.clave);
    const id = this.documentoId();

    // La cabecera va primero: las líneas necesitan su id para colgarse.
    const guardarCabecera = id
      ? cabeceras.actualizar(id, this.cuerpoCabecera())
      : cabeceras.crear(this.cuerpoCabecera());

    guardarCabecera
      .pipe(
        switchMap((cabecera: DocumentoCabecera) => {
          const padreId = cabecera.id;
          const peticiones = [
            ...this.lineasEliminadas().map((idLinea) => detalles.desactivar(idLinea)),
            ...this.lineas().map((linea) =>
              linea.id
                ? detalles.actualizar(linea.id, this.cuerpoLinea(linea, padreId))
                : detalles.crear(this.cuerpoLinea(linea, padreId)),
            ),
          ];
          // `forkJoin` de una lista vacía no emite nunca: con un documento sin
          // cambios en el detalle el guardado se quedaba colgado.
          return peticiones.length ? forkJoin(peticiones) : of([]);
        }),
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.msg.add({
            severity: 'success',
            summary: id ? 'Documento actualizado' : 'Documento creado',
            detail: `Se guardó ${t.articulo} ${t.singular} con ${this.lineas().length} línea(s).`,
            life: 3000,
          });
          this.volver();
        },
        error: (e: AppError) => {
          this.guardando.set(false);
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo guardar',
            detail: e.message,
          });
        },
      });
  }

  volver(): void {
    this.router.navigate(['/', this.tipo().clave]);
  }
}
