import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  EquipeResponseDto,
  EquipeRequestDto,
  LocalPresencialRequestDto,
  LocalPresencialSemIdDto,
  PaginacaoResponseDto,
} from '../models/equipe.model';

/**
 * EQUIPE.SERVICE
 *
 * Comunicação HTTP com o backend no domínio de EQUIPES.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Endpoints consumidos:
 *   GET    /api/v1/equipes              → listarEquipes()
 *   GET    /api/v1/equipes/{id}         → buscarEquipePorId()
 *   POST   /api/v1/equipes/cadastrar    → cadastrarEquipe() (passo 1)
 *   POST   /api/v1/locais-presenciais   → cadastrarEquipe() (passo 2, se não ONLINE)
 *   PUT    /api/v1/equipes/{id}         → editarEquipe()
 */
@Injectable({ providedIn: 'root' })
export class EquipeService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private apiEquipes = environment.api.equipes;
  private apiLocais = environment.api.locaisPresenciais;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * listarEquipes(page, size)
   *
   * Lista equipes com paginação.
   * HTTP: GET /api/v1/equipes?page=0&size=10
   */
  listarEquipes(page: number = 0, size: number = 10): Observable<PaginacaoResponseDto<EquipeResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<EquipeResponseDto>>(
      this.apiEquipes.listar,
      { params }
    );
  }

  /**
   * buscarEquipePorId(id)
   *
   * Busca uma equipe específica pelo ID.
   * HTTP: GET /api/v1/equipes/{id}
   */
  buscarEquipePorId(id: number): Observable<EquipeResponseDto> {
    return this.http.get<EquipeResponseDto>(this.apiEquipes.buscarPorId(id));
  }

  /**
   * cadastrarEquipe(equipe, local?)
   *
   * Cria uma nova equipe. Quando o modelo não for ONLINE, encadeia
   * automaticamente o segundo endpoint para salvar o endereço presencial.
   *
   * Fluxo interno (transparente para o componente):
   *   1. POST /api/v1/equipes/cadastrar       → recebe idEquipe na resposta
   *   2. Se local !== null:
   *      POST /api/v1/locais-presenciais       → com idEquipe preenchido
   *   3. Retorna o EquipeResponseDto do passo 1 em ambos os casos
   *
   * Por que switchMap?
   *   switchMap transforma o Observable do passo 1 em outro Observable (passo 2),
   *   criando uma cadeia sequencial. O componente não precisa saber que existem
   *   dois endpoints — para ele é sempre uma única operação.
   *
   * @param equipe  dados principais da equipe
   * @param local   endereço presencial (null se modeloReuniao === 'ONLINE')
   * @returns Observable<EquipeResponseDto> — o mesmo DTO do passo 1
   */
  cadastrarEquipe(
    equipe: EquipeRequestDto,
    local: LocalPresencialSemIdDto | null
  ): Observable<EquipeResponseDto> {
    return this.http.post<EquipeResponseDto>(this.apiEquipes.cadastrar, equipe).pipe(
      switchMap(equipeResponse => {

        // Se não há endereço (modelo ONLINE), encerra aqui
        if (local === null) {
          return of(equipeResponse);
        }

        // Monta o payload do passo 2 com o idEquipe recebido no passo 1
        const localPayload: LocalPresencialRequestDto = {
          ...local,
          idEquipe: equipeResponse.idEquipe,
        };

        // Faz o POST do endereço e retorna o EquipeResponseDto original
        return this.http
          .post<unknown>(this.apiLocais.cadastrar, localPayload)
          .pipe(map(() => equipeResponse));
      })
    );
  }

  /**
   * editarEquipe(id, equipe)
   *
   * Atualiza uma equipe existente.
   * HTTP: PUT /api/v1/equipes/{id}
   */
  editarEquipe(id: number, equipe: EquipeRequestDto): Observable<EquipeResponseDto> {
    return this.http.put<EquipeResponseDto>(this.apiEquipes.editar(id), equipe);
  }
}
