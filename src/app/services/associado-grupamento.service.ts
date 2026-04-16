/**
 * ASSOCIADO-GRUPAMENTO.SERVICE.TS
 * Comunicação HTTP para o módulo de Grupamentos Estratégicos do Associado.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Endpoints consumidos:
 *   GET  /api/v1/associados-grupamentos/associado/{id} → listarPorAssociado()
 *   POST /api/v1/associados-grupamentos                → vincular()
 *   PUT  /api/v1/associados-grupamentos/{id}           → editarVinculo() (inclui desvincular)
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssociadoGrupamentoResponseDto,
  AssociadoGrupamentoRequestDto,
} from '../models/associado-grupamento.model';

@Injectable({ providedIn: 'root' })
export class AssociadoGrupamentoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.associadosGrupamentos;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * listarPorAssociado(idAssociado)
   * HTTP: GET /api/v1/associados-grupamentos/associado/{id}
   * Retorna todos os grupamentos (ativos e históricos) vinculados ao associado.
   */
  listarPorAssociado(idAssociado: number): Observable<AssociadoGrupamentoResponseDto[]> {
    return this.http.get<AssociadoGrupamentoResponseDto[]>(
      this.api.porAssociado(idAssociado)
    );
  }

  /**
   * vincular(dto)
   * HTTP: POST /api/v1/associados-grupamentos
   * Vincula o associado a um grupamento estratégico.
   */
  vincular(dto: AssociadoGrupamentoRequestDto): Observable<AssociadoGrupamentoResponseDto> {
    return this.http.post<AssociadoGrupamentoResponseDto>(
      this.api.cadastrar,
      dto
    );
  }

  /**
   * editarVinculo(id, dto)
   * HTTP: PUT /api/v1/associados-grupamentos/{id}
   * Usado para atualizar datas ou desvincular (ativo: false, dataFim preenchida).
   */
  editarVinculo(
    id: number,
    dto: AssociadoGrupamentoRequestDto
  ): Observable<AssociadoGrupamentoResponseDto> {
    return this.http.put<AssociadoGrupamentoResponseDto>(
      this.api.editar(id),
      dto
    );
  }
}
