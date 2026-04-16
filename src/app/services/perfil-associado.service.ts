/**
 * PERFIL-ASSOCIADO.SERVICE.TS
 * Comunicação HTTP para o módulo Perfil C+C.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Endpoints consumidos:
 *   POST /api/v1/perfis                  → cadastrarPerfil()
 *   PUT  /api/v1/perfis/{id}             → editarPerfil()
 *   GET  /api/v1/perfis/associado/{id}   → buscarPorAssociado()
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PerfilAssociadoResponseDto,
  PerfilAssociadoRequestDto,
} from '../models/perfil-associado.model';

@Injectable({ providedIn: 'root' })
export class PerfilAssociadoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.perfisAssociado;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * buscarPorAssociado(idAssociado)
   * HTTP: GET /api/v1/perfis/associado/{id}
   * Retorna 404 se o perfil ainda não foi cadastrado.
   * O componente deve tratar esse caso para exibir o formulário de cadastro.
   */
  buscarPorAssociado(idAssociado: number): Observable<PerfilAssociadoResponseDto> {
    return this.http.get<PerfilAssociadoResponseDto>(
      this.api.porAssociado(idAssociado)
    );
  }

  /**
   * cadastrarPerfil(dto)
   * HTTP: POST /api/v1/perfis
   */
  cadastrarPerfil(dto: PerfilAssociadoRequestDto): Observable<PerfilAssociadoResponseDto> {
    return this.http.post<PerfilAssociadoResponseDto>(
      this.api.cadastrar,
      dto
    );
  }

  /**
   * editarPerfil(id, dto)
   * HTTP: PUT /api/v1/perfis/{id}
   */
  editarPerfil(
    id: number,
    dto: PerfilAssociadoRequestDto
  ): Observable<PerfilAssociadoResponseDto> {
    return this.http.put<PerfilAssociadoResponseDto>(
      this.api.editar(id),
      dto
    );
  }
}
