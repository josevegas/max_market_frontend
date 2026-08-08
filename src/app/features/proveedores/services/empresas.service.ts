import { Injectable } from "@angular/core";
import { Empresa,EmpresaCreate,EmpresaUpdate } from "../models/catalogo.model";
import { RecursoService } from "../../productos/services/catalogo.service";

@Injectable({providedIn:'root'})
export class EmpresaService extends RecursoService<Empresa,EmpresaCreate,EmpresaUpdate>{
    protected readonly ruta = 'empresas';
}