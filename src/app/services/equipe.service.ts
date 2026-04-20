import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EquipeResponseDto,
  EquipeRequestDto,
  LocalPresencialRequestDto,
  LocalPresencialResponseDto,
} from '../models/equipe.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

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
 *   GET    /api/v1/equipes                           → listarEquipes()
 *   GET    /api/v1/equipes/{id}                      → buscarEquipePorId()
 *   POST   /api/v1/equipes/cadastrar                 → cadastrarEquipe() (payload único, inclui localPresencial)
 *   PUT    /api/v1/equipes/{id}                      → editarEquipe()
 *   GET    /api/v1/locais-presenciais/equipe/{id}    → buscarLocalPresencial()
 *   PUT    /api/v1/locais-presenciais/{id}           → editarLocalPresencial()
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
   * cadastrarEquipe(equipe)
   *
   * Cria uma nova equipe em um único POST atômico.
   * O campo localPresencial dentro do EquipeRequestDto é enviado quando
   * modeloReuniao ≠ ONLINE — o backend persiste equipe + endereço na mesma
   * transação (@Transactional), garantindo que nunca fique equipe sem endereço.
   *
   * HTTP: POST /api/v1/equipes/cadastrar
   * @returns Observable<EquipeResponseDto> — inclui localPresencial na resposta
   */
  cadastrarEquipe(equipe: EquipeRequestDto): Observable<EquipeResponseDto> {
    return this.http.post<EquipeResponseDto>(this.apiEquipes.cadastrar, equipe);
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

  /**
   * buscarLocalPresencial(idEquipe)
   *
   * Busca o endereço presencial de uma equipe específica.
   * Chamado sob demanda (lazy) ao abrir o modal de endereço — não antecipado na listagem.
   * HTTP: GET /api/v1/locais-presenciais/equipe/{idEquipe}
   */
  buscarLocalPresencial(idEquipe: number): Observable<LocalPresencialResponseDto> {
    return this.http.get<LocalPresencialResponseDto>(this.apiLocais.porEquipe(idEquipe));
  }

  /**
   * editarLocalPresencial(idLocal, dto)
   *
   * Atualiza o endereço presencial de uma equipe.
   * HTTP: PUT /api/v1/locais-presenciais/{idLocal}
   *
   * Recebe LocalPresencialRequestDto (com idEquipe) porque o backend exige o campo
   * no corpo do PUT. Diferente do cadastro (onde o service preenche idEquipe via
   * switchMap), aqui o componente já tem o idEquipe disponível em enderecoAtual()
   * e monta o DTO completo antes de chamar este método.
   *
   * @param idLocal  ID do registro de local presencial (retornado pelo buscarLocalPresencial)
   * @param dto      DTO completo com idEquipe preenchido pelo componente
   */
  editarLocalPresencial(
    idLocal: number,
    dto: LocalPresencialRequestDto
  ): Observable<LocalPresencialResponseDto> {
    return this.http.put<LocalPresencialResponseDto>(this.apiLocais.editar(idLocal), dto);
  }
}
