/**
 * EQUIPE-DIRETOR.SERVICE.TS
 * Comunicação HTTP para Diretor de Equipe (DE) e Diretor de Território (DT).
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Dois domínios num único service (DE + DT) porque:
 * - São sempre usados em conjunto (mesmo modal)
 * - Ambos representam o mesmo conceito operacional: "diretores de uma equipe"
 *
 * Endpoints consumidos:
 *   POST /api/v1/diretores-equipe                  → cadastrarDiretorEquipe()
 *   GET  /api/v1/diretores-equipe/equipe/{id}      → listarDiretoresEquipe()
 *   PUT  /api/v1/diretores-equipe/{id}             → editarDiretorEquipe()
 *
 *   POST /api/v1/diretores-territorio              → cadastrarDiretorTerritorio()
 *   GET  /api/v1/diretores-territorio/equipe/{id}  → listarDiretoresTerritorio()
 *   PUT  /api/v1/diretores-territorio/{id}         → editarDiretorTerritorio()
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EquipeDiretorEquipeRequestDto,
  EquipeDiretorEquipeResponseDto,
  EquipeDiretorTerritorioRequestDto,
  EquipeDiretorTerritorioResponseDto,
} from '../models/equipe-diretor.model';

@Injectable({ providedIn: 'root' })
export class EquipeDiretorService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private apiDE = environment.api.diretoresEquipe;
  private apiDT = environment.api.diretoresTerritorio;

  // =========================================================================
  // DIRETOR DE EQUIPE (DE)
  // =========================================================================

  /**
   * listarDiretoresEquipe(idEquipe)
   * HTTP: GET /api/v1/diretores-equipe/equipe/{id}
   * Retorna histórico completo (ativos e encerrados).
   * Ativo = dataFim === null.
   */
  listarDiretoresEquipe(idEquipe: number): Observable<EquipeDiretorEquipeResponseDto[]> {
    return this.http.get<EquipeDiretorEquipeResponseDto[]>(
      this.apiDE.porEquipe(idEquipe)
    );
  }

  /**
   * cadastrarDiretorEquipe(dto)
   * HTTP: POST /api/v1/diretores-equipe
   * Designa um associado como Diretor de Equipe.
   */
  cadastrarDiretorEquipe(
    dto: EquipeDiretorEquipeRequestDto
  ): Observable<EquipeDiretorEquipeResponseDto> {
    return this.http.post<EquipeDiretorEquipeResponseDto>(
      this.apiDE.cadastrar,
      dto
    );
  }

  /**
   * editarDiretorEquipe(id, dto)
   * HTTP: PUT /api/v1/diretores-equipe/{id}
   * Usado para encerrar a vigência: enviar dataFim preenchida.
   */
  editarDiretorEquipe(
    id: number,
    dto: EquipeDiretorEquipeRequestDto
  ): Observable<EquipeDiretorEquipeResponseDto> {
    return this.http.put<EquipeDiretorEquipeResponseDto>(
      this.apiDE.editar(id),
      dto
    );
  }

  // =========================================================================
  // DIRETOR DE TERRITÓRIO (DT)
  // =========================================================================

  /**
   * listarDiretoresTerritorio(idEquipe)
   * HTTP: GET /api/v1/diretores-territorio/equipe/{id}
   * Retorna histórico completo (ativos e encerrados).
   * Ativo = dataFim === null.
   */
  listarDiretoresTerritorio(idEquipe: number): Observable<EquipeDiretorTerritorioResponseDto[]> {
    return this.http.get<EquipeDiretorTerritorioResponseDto[]>(
      this.apiDT.porEquipe(idEquipe)
    );
  }

  /**
   * cadastrarDiretorTerritorio(dto)
   * HTTP: POST /api/v1/diretores-territorio
   * Designa um associado como Diretor de Território em um nível específico.
   * O campo nivel deve ser: 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'.
   */
  cadastrarDiretorTerritorio(
    dto: EquipeDiretorTerritorioRequestDto
  ): Observable<EquipeDiretorTerritorioResponseDto> {
    return this.http.post<EquipeDiretorTerritorioResponseDto>(
      this.apiDT.cadastrar,
      dto
    );
  }

  /**
   * editarDiretorTerritorio(id, dto)
   * HTTP: PUT /api/v1/diretores-territorio/{id}
   * Usado para encerrar vigência. Para promoção de nível, encerre este e
   * crie um novo com o nivel atualizado via cadastrarDiretorTerritorio().
   */
  editarDiretorTerritorio(
    id: number,
    dto: EquipeDiretorTerritorioRequestDto
  ): Observable<EquipeDiretorTerritorioResponseDto> {
    return this.http.put<EquipeDiretorTerritorioResponseDto>(
      this.apiDT.editar(id),
      dto
    );
  }
}
