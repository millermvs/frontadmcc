import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CargoLiderancaResponseDto,
  CargoLiderancaRequestDto,
  PaginacaoResponseDto,
} from '../models/cargo-lideranca.model';

// ============================================================
// CargoLiderancaService
// ============================================================
// Responsabilidade: comunicação HTTP com /api/v1/cargos-lideranca.
//
// Regra do projeto: 1 service por domínio.
// URLs vêm do environment — nunca hardcoded aqui.
//
// Não existe DELETE: inativação é um PUT com ativo: false.
// O método inativar() e reativar() são atalhos semânticos
// que chamam editar() internamente com ativo alterado —
// isso mantém o chamador do componente mais expressivo.
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class CargoLiderancaService {

  private api = environment.api.cargosLideranca;

  constructor(private http: HttpClient) {}

  /**
   * Lista cargos com paginação.
   * A API ordena por nomeCargo ASC (fixo no backend).
   *
   * @param page  Número da página, zero-based (padrão: 0)
   * @param size  Itens por página (padrão: 20)
   */
  listar(
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<CargoLiderancaResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<CargoLiderancaResponseDto>>(
      this.api.listar,
      { params }
    );
  }

  /**
   * Busca um cargo pelo ID.
   * Usado principalmente para verificações pontuais.
   * Em edição, aproveitamos o objeto já carregado na lista.
   */
  buscarPorId(id: number): Observable<CargoLiderancaResponseDto> {
    return this.http.get<CargoLiderancaResponseDto>(this.api.buscarPorId(id));
  }

  /**
   * Cadastra um novo cargo.
   * A API normaliza nomeCargo com primeiraLetraMaiuscula() —
   * o componente deve atualizar a lista com a resposta, não com o form.
   */
  cadastrar(dto: CargoLiderancaRequestDto): Observable<CargoLiderancaResponseDto> {
    return this.http.post<CargoLiderancaResponseDto>(this.api.cadastrar, dto);
  }

  /**
   * Edita um cargo existente (payload completo — não é PATCH).
   * Usado para alterações normais e também para inativar/reativar.
   */
  editar(
    id: number,
    dto: CargoLiderancaRequestDto
  ): Observable<CargoLiderancaResponseDto> {
    return this.http.put<CargoLiderancaResponseDto>(this.api.editar(id), dto);
  }

  /**
   * Atalho semântico: inativa um cargo via PUT com ativo: false.
   * Os demais campos são preservados — a API exige o payload completo.
   */
  inativar(cargo: CargoLiderancaResponseDto): Observable<CargoLiderancaResponseDto> {
    const dto: CargoLiderancaRequestDto = {
      nomeCargo: cargo.nomeCargo,
      classificacaoFinanceira: cargo.classificacaoFinanceira,
      categoriaPermissao: cargo.categoriaPermissao,
      ativo: false,
    };
    return this.editar(cargo.idCargoLideranca, dto);
  }

  /**
   * Atalho semântico: reativa um cargo via PUT com ativo: true.
   */
  reativar(cargo: CargoLiderancaResponseDto): Observable<CargoLiderancaResponseDto> {
    const dto: CargoLiderancaRequestDto = {
      nomeCargo: cargo.nomeCargo,
      classificacaoFinanceira: cargo.classificacaoFinanceira,
      categoriaPermissao: cargo.categoriaPermissao,
      ativo: true,
    };
    return this.editar(cargo.idCargoLideranca, dto);
  }
}
