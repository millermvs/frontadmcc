/**
 * ASSOCIADO-CARGO.SERVICE.TS
 * Comunicação HTTP para o módulo de Cargos de Liderança do Associado.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Endpoints consumidos:
 *   GET  /api/v1/associados-cargos/associado/{id} → listarPorAssociado()
 *   POST /api/v1/associados-cargos                → designarCargo()
 *   PUT  /api/v1/associados-cargos/{id}           → editarCargo() (inclui encerrar: ativo: false)
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssociadoCargoLiderancaResponseDto,
  AssociadoCargoLiderancaRequestDto,
} from '../models/associado-cargo.model';

@Injectable({ providedIn: 'root' })
export class AssociadoCargoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.associadosCargos;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * listarPorAssociado(idAssociado)
   * HTTP: GET /api/v1/associados-cargos/associado/{id}
   * Retorna todos os cargos (ativos e históricos) do associado.
   */
  listarPorAssociado(idAssociado: number): Observable<AssociadoCargoLiderancaResponseDto[]> {
    return this.http.get<AssociadoCargoLiderancaResponseDto[]>(
      this.api.porAssociado(idAssociado)
    );
  }

  /**
   * designarCargo(dto)
   * HTTP: POST /api/v1/associados-cargos
   * Designa um novo cargo ao associado.
   * Regra: não pode haver dois cargos ativos com o mesmo idCargoLideranca para o mesmo associado.
   */
  designarCargo(
    dto: AssociadoCargoLiderancaRequestDto
  ): Observable<AssociadoCargoLiderancaResponseDto> {
    return this.http.post<AssociadoCargoLiderancaResponseDto>(
      this.api.cadastrar,
      dto
    );
  }

  /**
   * editarCargo(id, dto)
   * HTTP: PUT /api/v1/associados-cargos/{id}
   * Usado para atualizar datas ou encerrar o cargo (ativo: false, dataFim preenchida).
   */
  editarCargo(
    id: number,
    dto: AssociadoCargoLiderancaRequestDto
  ): Observable<AssociadoCargoLiderancaResponseDto> {
    return this.http.put<AssociadoCargoLiderancaResponseDto>(
      this.api.editar(id),
      dto
    );
  }
}
