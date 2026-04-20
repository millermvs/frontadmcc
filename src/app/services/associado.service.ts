/**
 * ASSOCIADO.SERVICE.TS
 * Comunicação HTTP com o backend no domínio de ASSOCIADOS.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 * - Injeção via inject() — sem constructor injection
 *
 * Endpoints consumidos:
 *   GET    /api/v1/associados                             → listarAssociados()
 *   GET    /api/v1/associados/{id}                        → buscarAssociadoPorId()
 *   POST   /api/v1/associados                             → cadastrarAssociado()
 *   PUT    /api/v1/associados/{id}                        → editarAssociado()
 *   PATCH  /api/v1/associados/{id}/confirmar-cadastro     → confirmarCadastro()
 *   PATCH  /api/v1/associados/{id}/alterar-status         → alterarStatus()
 *   PATCH  /api/v1/associados/{id}/renovar-anuidade       → renovarAnuidade()
 *   GET    /api/v1/associados/{id}/historico-status       → historicoStatus()
 *   GET    /api/v1/enderecos-residenciais/associado/{id}  → listarEnderecosResidenciais()
 *   POST   /api/v1/enderecos-residenciais/associado/{id}  → cadastrarEnderecoResidencial()
 *   PUT    /api/v1/enderecos-residenciais/{id}            → editarEnderecoResidencial()
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssociadoResponseDto,
  AssociadoRequestDto,
  AssociadoAlterarStatusRequestDto,
  AssociadoRenovarAnuidadeRequestDto,
  AssociadoStatusHistoricoResponseDto,
  EnderecoResidencialResponseDto,
  EnderecoResidencialRequestDto,
} from '../models/associado.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

@Injectable({ providedIn: 'root' })
export class AssociadoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private apiAssociados = environment.api.associados;
  private apiEnderecos  = environment.api.enderecosResidenciais;

  // =========================================================================
  // LISTAGEM E BUSCA
  // =========================================================================

  /**
   * listarAssociados(page, size)
   * Lista associados com paginação.
   * HTTP: GET /api/v1/associados?page=0&size=10
   */
  listarAssociados(
    page: number = 0,
    size: number = 10
  ): Observable<PaginacaoResponseDto<AssociadoResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<AssociadoResponseDto>>(
      this.apiAssociados.listar,
      { params }
    );
  }

  /**
   * buscarAssociadoPorId(id)
   * HTTP: GET /api/v1/associados/{id}
   */
  buscarAssociadoPorId(id: number): Observable<AssociadoResponseDto> {
    return this.http.get<AssociadoResponseDto>(
      this.apiAssociados.buscarPorId(id)
    );
  }

  // =========================================================================
  // CADASTRO E EDIÇÃO
  // =========================================================================

  /**
   * cadastrarAssociado(dto)
   * HTTP: POST /api/v1/associados
   * Cria associado com status PREATIVO. O backend também cria automaticamente:
   * o vínculo com o cargo inicial, o endereço residencial e o registro de visibilidade.
   */
  cadastrarAssociado(dto: AssociadoRequestDto): Observable<AssociadoResponseDto> {
    return this.http.post<AssociadoResponseDto>(
      this.apiAssociados.cadastrar,
      dto
    );
  }

  /**
   * editarAssociado(id, dto)
   * HTTP: PUT /api/v1/associados/{id}
   * Na edição, enviar idEquipeOrigem com o valor original (sem alterar).
   * Status não muda por aqui — usar alterarStatus().
   */
  editarAssociado(id: number, dto: AssociadoRequestDto): Observable<AssociadoResponseDto> {
    return this.http.put<AssociadoResponseDto>(
      this.apiAssociados.editar(id),
      dto
    );
  }

  // =========================================================================
  // AÇÕES DE CICLO DE VIDA
  // =========================================================================

  /**
   * confirmarCadastro(id)
   * HTTP: PATCH /api/v1/associados/{id}/confirmar-cadastro
   * Transição PREATIVO → ATIVO. Sem body. Retorna 422 se status ≠ PREATIVO.
   */
  confirmarCadastro(id: number): Observable<AssociadoResponseDto> {
    return this.http.patch<AssociadoResponseDto>(
      this.apiAssociados.confirmarCadastro(id),
      {}
    );
  }

  /**
   * alterarStatus(id, dto)
   * HTTP: PATCH /api/v1/associados/{id}/alterar-status
   * Única forma de mudar o status. Cria registro imutável no histórico.
   */
  alterarStatus(
    id: number,
    dto: AssociadoAlterarStatusRequestDto
  ): Observable<AssociadoStatusHistoricoResponseDto> {
    return this.http.patch<AssociadoStatusHistoricoResponseDto>(
      this.apiAssociados.alterarStatus(id),
      dto
    );
  }

  /**
   * renovarAnuidade(id, dto)
   * HTTP: PATCH /api/v1/associados/{id}/renovar-anuidade
   * Retorna 422 para PREATIVO ou associados isentos.
   */
  renovarAnuidade(
    id: number,
    dto: AssociadoRenovarAnuidadeRequestDto
  ): Observable<AssociadoResponseDto> {
    return this.http.patch<AssociadoResponseDto>(
      this.apiAssociados.renovarAnuidade(id),
      dto
    );
  }

  /**
   * historicoStatus(id)
   * HTTP: GET /api/v1/associados/{id}/historico-status
   * Retorna o histórico completo de mudanças de status (mais recentes primeiro).
   */
  historicoStatus(id: number): Observable<AssociadoStatusHistoricoResponseDto[]> {
    return this.http.get<AssociadoStatusHistoricoResponseDto[]>(
      this.apiAssociados.historicoStatus(id)
    );
  }

  // =========================================================================
  // ENDEREÇOS RESIDENCIAIS
  // =========================================================================

  /**
   * listarEnderecosResidenciais(idAssociado)
   * HTTP: GET /api/v1/enderecos-residenciais/associado/{idAssociado}
   */
  listarEnderecosResidenciais(idAssociado: number): Observable<EnderecoResidencialResponseDto[]> {
    return this.http.get<EnderecoResidencialResponseDto[]>(
      this.apiEnderecos.porAssociado(idAssociado)
    );
  }

  /**
   * cadastrarEnderecoResidencial(idAssociado, dto)
   * HTTP: POST /api/v1/enderecos-residenciais/associado/{idAssociado}
   * O idAssociado vai na URL — não está no body do DTO.
   */
  cadastrarEnderecoResidencial(
    idAssociado: number,
    dto: EnderecoResidencialRequestDto
  ): Observable<EnderecoResidencialResponseDto> {
    return this.http.post<EnderecoResidencialResponseDto>(
      this.apiEnderecos.cadastrar(idAssociado),
      dto
    );
  }

  /**
   * editarEnderecoResidencial(id, dto)
   * HTTP: PUT /api/v1/enderecos-residenciais/{id}
   */
  editarEnderecoResidencial(
    id: number,
    dto: EnderecoResidencialRequestDto
  ): Observable<EnderecoResidencialResponseDto> {
    return this.http.put<EnderecoResidencialResponseDto>(
      this.apiEnderecos.editar(id),
      dto
    );
  }
}
