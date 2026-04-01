import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ClusterResponseDto,
  ClusterRequestDto,
  AtuacaoEspecificaResponseDto,
  AtuacaoEspecificaRequestDto,
  PaginacaoResponseDto as PaginacaoCluster,
} from '../models/cluster.model';

@Injectable({
  providedIn: 'root',
})
export class ClusterService {
  private apiUrlClusters = environment.api.clusters;
  private apiUrlAtuacoes = environment.api.atuacoesEspecificas;

  constructor(private http: HttpClient) {}

  /**
   * Lista todos os clusters com paginação
   * @param page número da página (começa em 0)
   * @param size tamanho da página
   */
  listarClusters(page: number = 0, size: number = 10): Observable<PaginacaoCluster<ClusterResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoCluster<ClusterResponseDto>>(this.apiUrlClusters.listar, { params });
  }

  /**
   * Busca um cluster por ID
   * @param id ID do cluster
   */
  buscarClusterPorId(id: number): Observable<ClusterResponseDto> {
    return this.http.get<ClusterResponseDto>(this.apiUrlClusters.buscarPorId(id));
  }

  /**
   * Cadastra um novo cluster
   * @param cluster dados do cluster
   */
  cadastrarCluster(cluster: ClusterRequestDto): Observable<ClusterResponseDto> {
    return this.http.post<ClusterResponseDto>(this.apiUrlClusters.cadastrar, cluster);
  }

  /**
   * Edita um cluster existente
   * @param id ID do cluster
   * @param cluster dados atualizados
   */
  editarCluster(id: number, cluster: ClusterRequestDto): Observable<ClusterResponseDto> {
    return this.http.put<ClusterResponseDto>(this.apiUrlClusters.editar(id), cluster);
  }

  /**
   * Lista as atuações específicas de um cluster
   * @param idCluster ID do cluster
   * @param page número da página (começa em 0)
   * @param size tamanho da página
   */
  listarAtuacoesPorCluster(
    idCluster: number,
    page: number = 0,
    size: number = 10
  ): Observable<PaginacaoCluster<AtuacaoEspecificaResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoCluster<AtuacaoEspecificaResponseDto>>(
      this.apiUrlAtuacoes.porCluster(idCluster),
      { params }
    );
  }

  /**
   * Lista todas as atuações específicas com paginação
   * @param page número da página (começa em 0)
   * @param size tamanho da página
   */
  listarAtuacoes(page: number = 0, size: number = 10): Observable<PaginacaoCluster<AtuacaoEspecificaResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoCluster<AtuacaoEspecificaResponseDto>>(this.apiUrlAtuacoes.listar, { params });
  }

  /**
   * Busca uma atuação específica por ID
   * @param id ID da atuação
   */
  buscarAtuacaoPorId(id: number): Observable<AtuacaoEspecificaResponseDto> {
    return this.http.get<AtuacaoEspecificaResponseDto>(this.apiUrlAtuacoes.buscarPorId(id));
  }

  /**
   * Cadastra uma nova atuação específica
   * @param atuacao dados da atuação
   */
  cadastrarAtuacao(atuacao: AtuacaoEspecificaRequestDto): Observable<AtuacaoEspecificaResponseDto> {
    return this.http.post<AtuacaoEspecificaResponseDto>(this.apiUrlAtuacoes.cadastrar, atuacao);
  }

  /**
   * Edita uma atuação específica existente
   * @param id ID da atuação
   * @param atuacao dados atualizados
   */
  editarAtuacao(id: number, atuacao: AtuacaoEspecificaRequestDto): Observable<AtuacaoEspecificaResponseDto> {
    return this.http.put<AtuacaoEspecificaResponseDto>(this.apiUrlAtuacoes.editar(id), atuacao);
  }
}
