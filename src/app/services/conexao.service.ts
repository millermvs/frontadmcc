import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConexaoGeradaResponseDto,
  ConexaoRecebidaResponseDto,
  ConexaoRequestDto,
  AtualizarStatusRequestDto,
} from '../models/conexao.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

/**
 * CONEXAO.SERVICE
 *
 * Comunicação HTTP com o backend no domínio de CONEXÕES (Fase 4 — Operacional).
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> com tipo explícito
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Conceito central (do guia de integração):
 * Existe um único registro por conexão no banco.
 * Os dois painéis leem o mesmo dado de perspectivas diferentes:
 *   - remetente → GET /geradas (ConexaoGeradaResponseDto)
 *   - destinatário → GET /recebidas (ConexaoRecebidaResponseDto)
 *
 * Endpoints consumidos:
 *   POST  /api/v1/conexoes                    → registrar()
 *   GET   /api/v1/conexoes/geradas            → listarGeradas()
 *   GET   /api/v1/conexoes/recebidas          → listarRecebidas()
 *   PATCH /api/v1/conexoes/{id}/status        → atualizarStatus()
 *   DELETE /api/v1/conexoes/{id}              → excluir()
 */
@Injectable({ providedIn: 'root' })
export class ConexaoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.conexoes;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * registrar(dto)
   *
   * Registra uma nova conexão (remetente = associado autenticado via JWT).
   * HTTP: POST /api/v1/conexoes
   *
   * @returns ConexaoGeradaResponseDto com status inicial NOVA
   */
  registrar(dto: ConexaoRequestDto): Observable<ConexaoGeradaResponseDto> {
    return this.http.post<ConexaoGeradaResponseDto>(this.api.registrar, dto);
  }

  /**
   * listarGeradas(page, size)
   *
   * Lista as conexões que o associado autenticado ENVIOU (painel Negócios Gerados).
   * A identidade do remetente é extraída do JWT pelo backend.
   * HTTP: GET /api/v1/conexoes/geradas?page=0&size=20
   */
  listarGeradas(
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<ConexaoGeradaResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<ConexaoGeradaResponseDto>>(
      this.api.geradas,
      { params }
    );
  }

  /**
   * listarRecebidas(page, size)
   *
   * Lista as conexões que o associado autenticado RECEBEU (painel Negócios Recebidos).
   * A identidade do destinatário é extraída do JWT pelo backend.
   * HTTP: GET /api/v1/conexoes/recebidas?page=0&size=20
   */
  listarRecebidas(
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<ConexaoRecebidaResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<ConexaoRecebidaResponseDto>>(
      this.api.recebidas,
      { params }
    );
  }

  /**
   * atualizarStatus(id, dto)
   *
   * Atualiza o status de uma conexão recebida (somente o destinatário pode chamar).
   * HTTP: PATCH /api/v1/conexoes/{id}/status
   *
   * Campos condicionais no dto (validados pelo backend):
   *   - valorNegocio: obrigatório se status = FECHADA
   *   - motivoNaoFechado: obrigatório se status = NAO_FECHADA
   *
   * @returns ConexaoRecebidaResponseDto atualizado — aplique localmente no signal
   *          para não precisar recarregar a lista inteira
   */
  atualizarStatus(
    id: number,
    dto: AtualizarStatusRequestDto
  ): Observable<ConexaoRecebidaResponseDto> {
    return this.http.patch<ConexaoRecebidaResponseDto>(
      this.api.atualizarStatus(id),
      dto
    );
  }

  /**
   * excluir(id)
   *
   * Remove uma conexão (somente o remetente pode chamar, e apenas com status NOVA).
   * HTTP: DELETE /api/v1/conexoes/{id}
   *
   * @returns void (204 No Content)
   */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(this.api.excluir(id));
  }
}
