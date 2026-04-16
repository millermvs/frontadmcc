/**
 * EMPRESA.SERVICE.TS
 * Comunicação HTTP para os domínios de Empresa e Endereço Comercial.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton global via @Injectable({ providedIn: 'root' })
 * - Cada método retorna Observable<T> tipado explicitamente
 * - URLs centralizadas no environment (nunca hardcoded)
 * - Nenhuma lógica de UI: sem DOM, sem toast, sem navegação
 *
 * Fluxo de uso (modal de empresa na listagem de associados):
 *   [1] cadastrarEmpresa()      → retorna EmpresaResponseDto com idEmpresa
 *   [2] cadastrarEndereco()     → usa o idEmpresa do passo [1]
 *
 * Endpoints consumidos:
 *   POST /api/v1/empresas                          → cadastrarEmpresa()
 *   PUT  /api/v1/empresas/{id}                     → editarEmpresa()
 *   GET  /api/v1/empresas/{id}                     → buscarEmpresaPorId()
 *   GET  /api/v1/empresas/associado/{id}           → buscarEmpresaPorAssociado()
 *   POST /api/v1/enderecos-comerciais              → cadastrarEndereco()
 *   PUT  /api/v1/enderecos-comerciais/{id}         → editarEndereco()
 *   GET  /api/v1/enderecos-comerciais/empresa/{id} → buscarEnderecoPorEmpresa()
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EmpresaResponseDto,
  EmpresaRequestDto,
  EmpresaEnderecoComercialResponseDto,
  EmpresaEnderecoComercialRequestDto,
} from '../models/empresa.model';

@Injectable({ providedIn: 'root' })
export class EmpresaService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private apiEmpresas  = environment.api.empresas;
  private apiEnderecos = environment.api.enderecosComerciais;

  // =========================================================================
  // EMPRESA
  // =========================================================================

  /**
   * buscarEmpresaPorId(id)
   * HTTP: GET /api/v1/empresas/{id}
   */
  buscarEmpresaPorId(id: number): Observable<EmpresaResponseDto> {
    return this.http.get<EmpresaResponseDto>(
      this.apiEmpresas.buscarPorId(id)
    );
  }

  /**
   * buscarEmpresaPorAssociado(idAssociado)
   * HTTP: GET /api/v1/empresas/associado/{id}
   * Retorna lista paginada, mas como um associado tem apenas 1 empresa,
   * o componente deve usar o primeiro item de items[].
   */
  buscarEmpresaPorAssociado(idAssociado: number): Observable<{ items: EmpresaResponseDto[] }> {
    return this.http.get<{ items: EmpresaResponseDto[] }>(
      this.apiEmpresas.porAssociado(idAssociado)
    );
  }

  /**
   * cadastrarEmpresa(dto)
   * HTTP: POST /api/v1/empresas
   * Retorna EmpresaResponseDto com idEmpresa — usar para o passo seguinte (endereço).
   */
  cadastrarEmpresa(dto: EmpresaRequestDto): Observable<EmpresaResponseDto> {
    return this.http.post<EmpresaResponseDto>(
      this.apiEmpresas.cadastrar,
      dto
    );
  }

  /**
   * editarEmpresa(id, dto)
   * HTTP: PUT /api/v1/empresas/{id}
   */
  editarEmpresa(id: number, dto: EmpresaRequestDto): Observable<EmpresaResponseDto> {
    return this.http.put<EmpresaResponseDto>(
      this.apiEmpresas.editar(id),
      dto
    );
  }

  // =========================================================================
  // ENDEREÇO COMERCIAL
  // =========================================================================

  /**
   * buscarEnderecoPorEmpresa(idEmpresa)
   * HTTP: GET /api/v1/enderecos-comerciais/empresa/{id}
   */
  buscarEnderecoPorEmpresa(idEmpresa: number): Observable<EmpresaEnderecoComercialResponseDto> {
    return this.http.get<EmpresaEnderecoComercialResponseDto>(
      this.apiEnderecos.porEmpresa(idEmpresa)
    );
  }

  /**
   * cadastrarEndereco(dto)
   * HTTP: POST /api/v1/enderecos-comerciais
   * Chamar após cadastrarEmpresa() — o idEmpresa vem no retorno daquele método.
   */
  cadastrarEndereco(
    dto: EmpresaEnderecoComercialRequestDto
  ): Observable<EmpresaEnderecoComercialResponseDto> {
    return this.http.post<EmpresaEnderecoComercialResponseDto>(
      this.apiEnderecos.cadastrar,
      dto
    );
  }

  /**
   * editarEndereco(id, dto)
   * HTTP: PUT /api/v1/enderecos-comerciais/{id}
   */
  editarEndereco(
    id: number,
    dto: EmpresaEnderecoComercialRequestDto
  ): Observable<EmpresaEnderecoComercialResponseDto> {
    return this.http.put<EmpresaEnderecoComercialResponseDto>(
      this.apiEnderecos.editar(id),
      dto
    );
  }
}
