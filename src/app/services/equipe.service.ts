import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EquipeResponseDto, EquipeRequestDto, PaginacaoResponseDto } from '../models/equipe.model';

@Injectable({
  providedIn: 'root',
})
export class EquipeService {
  private apiUrl = environment.api.equipes;

  constructor(private http: HttpClient) {}

  /**
   * Lista todas as equipes com paginação
   * @param page número da página (começa em 0)
   * @param size tamanho da página
   */
  listarEquipes(page: number = 0, size: number = 10): Observable<PaginacaoResponseDto<EquipeResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<EquipeResponseDto>>(this.apiUrl.listar, { params });
  }

  /**
   * Busca uma equipe por ID
   * @param id ID da equipe
   */
  buscarEquipePorId(id: number): Observable<EquipeResponseDto> {
    return this.http.get<EquipeResponseDto>(this.apiUrl.buscarPorId(id));
  }

  /**
   * Cadastra uma nova equipe
   * @param equipe dados da equipe
   */
  cadastrarEquipe(equipe: EquipeRequestDto): Observable<EquipeResponseDto> {
    return this.http.post<EquipeResponseDto>(this.apiUrl.cadastrar, equipe);
  }

  /**
   * Edita uma equipe existente
   * @param id ID da equipe
   * @param equipe dados atualizados
   */
  editarEquipe(id: number, equipe: EquipeRequestDto): Observable<EquipeResponseDto> {
    return this.http.put<EquipeResponseDto>(this.apiUrl.editar(id), equipe);
  }
}
