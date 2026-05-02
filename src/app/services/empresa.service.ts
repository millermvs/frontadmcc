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
 * Fluxo CADASTRO (modal Bloco 6 — modo cadastro):
 *   cadastrarEmpresaComEndereco() → POST único com empresa + endereço juntos.
 *   O backend persiste ambos atomicamente. Não há segunda chamada.
 *
 * Fluxo EDIÇÃO (modal Bloco 6 — modo edição):
 *   editarEmpresa()   → PUT /api/v1/empresas/{id}
 *   editarEndereco()  → PUT /api/v1/enderecos-comerciais/{id}
 *   Os dois PUTs são disparados em paralelo via forkJoin no componente.
 *
 * Endpoints consumidos:
 *   POST /api/v1/empresas                          → cadastrarEmpresaComEndereco()
 *   PUT  /api/v1/empresas/{id}                     → editarEmpresa()
 *   GET  /api/v1/empresas/{id}                     → buscarEmpresaPorId()
 *   GET  /api/v1/empresas/associado/{id}           → buscarEmpresaPorAssociado()
 *   PUT  /api/v1/enderecos-comerciais/{id}         → editarEndereco()
 *   GET  /api/v1/enderecos-comerciais/empresa/{id} → buscarEnderecoPorEmpresa()
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EmpresaResponseDto,
  EmpresaRequestDto,
  EmpresaCadastroRequestDto,
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
   * HTTP: GET /api/v1/empresas/associado/{id}?number=0&size=50
   *
   * Retorna lista paginada com todas as empresas do associado.
   * Um associado pode ter múltiplas empresas — size=50 cobre casos reais
   * sem paginação adicional na UI do modal.
   */
  buscarEmpresaPorAssociado(idAssociado: number): Observable<{ items: EmpresaResponseDto[] }> {
    const params = new HttpParams().set('number', '0').set('size', '50');
    return this.http.get<{ items: EmpresaResponseDto[] }>(
      this.apiEmpresas.porAssociado(idAssociado),
      { params }
    );
  }

  /**
   * cadastrarEmpresaComEndereco(dto)
   * HTTP: POST /api/v1/empresas
   *
   * Fluxo CADASTRO do modal Bloco 6: persiste Empresa e EmpresaEnderecoComercial
   * em uma única transação no backend. O dto contém todos os campos — empresa
   * e endereço juntos. Nunca chamar no fluxo de edição.
   */
  cadastrarEmpresaComEndereco(dto: EmpresaCadastroRequestDto): Observable<EmpresaResponseDto> {
    return this.http.post<EmpresaResponseDto>(
      this.apiEmpresas.cadastrar,
      dto
    );
  }

  /**
   * editarEmpresa(id, dto)
   * HTTP: PUT /api/v1/empresas/{id}
   * Fluxo EDIÇÃO: apenas os campos da empresa, sem endereço.
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
   * Retorna o endereço comercial único vinculado à empresa.
   * O idEnderecoComercial do response é necessário para o PUT de edição.
   */
  buscarEnderecoPorEmpresa(idEmpresa: number): Observable<EmpresaEnderecoComercialResponseDto> {
    return this.http.get<EmpresaEnderecoComercialResponseDto>(
      this.apiEnderecos.porEmpresa(idEmpresa)
    );
  }

  /**
   * editarEndereco(id, dto)
   * HTTP: PUT /api/v1/enderecos-comerciais/{id}
   * Fluxo EDIÇÃO: nunca usar POST aqui — criaria um segundo endereço e
   * corromperia a unicidade do endereço comercial da empresa.
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
