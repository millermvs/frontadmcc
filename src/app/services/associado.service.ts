import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AssociadoResponseDto,
  AssociadoRequestDto,
  EnderecoResidencialResponseDto,
  EnderecoResidencialRequestDto,
  PaginacaoResponseDto as PaginacaoAssociado,
} from '../models/associado.model';

@Injectable({
  providedIn: 'root',
})
export class AssociadoService {
  private apiUrl = environment.api.associados;
  private apiUrlEnderecos = environment.api.enderecosResidenciais;

  constructor(private http: HttpClient) {}

  /**
   * Lista todos os associados com paginação
   * @param page número da página (começa em 0)
   * @param size tamanho da página
   */
  listarAssociados(page: number = 0, size: number = 10): Observable<PaginacaoAssociado<AssociadoResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoAssociado<AssociadoResponseDto>>(this.apiUrl.listar, { params });
  }

  /**
   * Busca um associado por ID
   * @param id ID do associado
   */
  buscarAssociadoPorId(id: number): Observable<AssociadoResponseDto> {
    return this.http.get<AssociadoResponseDto>(this.apiUrl.buscarPorId(id));
  }

  /**
   * Cadastra um novo associado
   * @param associado dados do associado
   */
  cadastrarAssociado(associado: AssociadoRequestDto): Observable<AssociadoResponseDto> {
    return this.http.post<AssociadoResponseDto>(this.apiUrl.cadastrar, associado);
  }

  /**
   * Edita um associado existente
   * @param id ID do associado
   * @param associado dados atualizados
   */
  editarAssociado(id: number, associado: AssociadoRequestDto): Observable<AssociadoResponseDto> {
    return this.http.put<AssociadoResponseDto>(this.apiUrl.editar(id), associado);
  }

  /**
   * Lista os endereços residenciais de um associado
   * @param idAssociado ID do associado
   */
  listarEnderecosResidenciais(idAssociado: number): Observable<EnderecoResidencialResponseDto[]> {
    return this.http.get<EnderecoResidencialResponseDto[]>(
      this.apiUrlEnderecos.porAssociado(idAssociado)
    );
  }

  /**
   * Cadastra um novo endereço residencial
   * @param endereco dados do endereço
   */
  cadastrarEnderecoResidencial(endereco: EnderecoResidencialRequestDto): Observable<EnderecoResidencialResponseDto> {
    return this.http.post<EnderecoResidencialResponseDto>(this.apiUrlEnderecos.cadastrar, endereco);
  }

  /**
   * Edita um endereço residencial existente
   * @param id ID do endereço
   * @param endereco dados atualizados
   */
  editarEnderecoResidencial(
    id: number,
    endereco: EnderecoResidencialRequestDto
  ): Observable<EnderecoResidencialResponseDto> {
    return this.http.put<EnderecoResidencialResponseDto>(
      this.apiUrlEnderecos.editar(id),
      endereco
    );
  }
}
