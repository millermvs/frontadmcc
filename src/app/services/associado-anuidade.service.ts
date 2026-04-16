/**
 * ASSOCIADO-ANUIDADE.SERVICE.TS
 * Comunicação HTTP para os módulos de Anuidades e Renovações do Associado.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Endpoints consumidos:
 *   POST /api/v1/associados-anuidades              → cadastrarAnuidade()
 *   PUT  /api/v1/associados-anuidades/{id}         → editarAnuidade()
 *   GET  /api/v1/associados-anuidades/associado/{id}→ listarAnuidades()
 *   GET  /api/v1/associados-renovacoes/associado/{id}→ listarRenovacoes() (somente leitura)
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssociadoAnuidadeResponseDto,
  AssociadoAnuidadeRequestDto,
  AssociadoRenovacaoResponseDto,
} from '../models/associado-anuidade.model';

@Injectable({ providedIn: 'root' })
export class AssociadoAnuidadeService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private apiAnuidades  = environment.api.anuidades;
  private apiRenovacoes = environment.api.renovacoes;

  // =========================================================================
  // ANUIDADES
  // =========================================================================

  /**
   * listarAnuidades(idAssociado)
   * HTTP: GET /api/v1/associados-anuidades/associado/{id}
   */
  listarAnuidades(idAssociado: number): Observable<AssociadoAnuidadeResponseDto[]> {
    return this.http.get<AssociadoAnuidadeResponseDto[]>(
      this.apiAnuidades.porAssociado(idAssociado)
    );
  }

  /**
   * cadastrarAnuidade(dto)
   * HTTP: POST /api/v1/associados-anuidades
   * Retorna 409 se já existir anuidade do mesmo ano para o mesmo associado.
   */
  cadastrarAnuidade(dto: AssociadoAnuidadeRequestDto): Observable<AssociadoAnuidadeResponseDto> {
    return this.http.post<AssociadoAnuidadeResponseDto>(
      this.apiAnuidades.cadastrar,
      dto
    );
  }

  /**
   * editarAnuidade(id, dto)
   * HTTP: PUT /api/v1/associados-anuidades/{id}
   */
  editarAnuidade(
    id: number,
    dto: AssociadoAnuidadeRequestDto
  ): Observable<AssociadoAnuidadeResponseDto> {
    return this.http.put<AssociadoAnuidadeResponseDto>(
      this.apiAnuidades.editar(id),
      dto
    );
  }

  // =========================================================================
  // RENOVAÇÕES (somente leitura)
  // =========================================================================

  /**
   * listarRenovacoes(idAssociado)
   * HTTP: GET /api/v1/associados-renovacoes/associado/{id}
   * Renovações são criadas automaticamente pelo PATCH /renovar-anuidade.
   * Este endpoint é somente leitura — sem POST manual.
   */
  listarRenovacoes(idAssociado: number): Observable<AssociadoRenovacaoResponseDto[]> {
    return this.http.get<AssociadoRenovacaoResponseDto[]>(
      this.apiRenovacoes.porAssociado(idAssociado)
    );
  }
}
