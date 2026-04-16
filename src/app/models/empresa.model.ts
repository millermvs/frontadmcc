/**
 * EMPRESA.MODEL.TS
 * DTOs para os módulos de Empresa e Endereço Comercial
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Fluxo:
 *   [1] POST /api/v1/empresas                      → cria empresa → retorna EmpresaResponseDto
 *   [2] POST /api/v1/enderecos-comerciais           → cria endereço usando idEmpresa do passo [1]
 *
 * Endpoints cobertos:
 *   POST  /api/v1/empresas                          → EmpresaRequestDto
 *   PUT   /api/v1/empresas/{id}                     → EmpresaRequestDto
 *   GET   /api/v1/empresas/{id}                     → EmpresaResponseDto
 *   GET   /api/v1/empresas/associado/{id}           → PaginacaoResponseDto<EmpresaResponseDto>
 *   POST  /api/v1/enderecos-comerciais              → EmpresaEnderecoComercialRequestDto
 *   PUT   /api/v1/enderecos-comerciais/{id}         → EmpresaEnderecoComercialRequestDto
 *   GET   /api/v1/enderecos-comerciais/empresa/{id} → EmpresaEnderecoComercialResponseDto
 */

// ============================================================================
// EMPRESA
// ============================================================================

/**
 * EmpresaResponseDto
 * Retornado pelo backend após criar, editar ou buscar uma empresa.
 */
export interface EmpresaResponseDto {
  idEmpresa: number;
  razaoSocial: string;
  cnpj: string;
  nomeFantasia: string | null;
  nomeAssociado: string;
}

/**
 * EmpresaRequestDto
 * Payload para POST e PUT de empresa.
 * CNPJ: enviar apenas os 14 dígitos numéricos, sem pontuação.
 */
export interface EmpresaRequestDto {
  idAssociado: number;
  razaoSocial: string;
  cnpj: string;           // 14 dígitos, sem pontuação
  nomeFantasia: string | null;
}

// ============================================================================
// ENDEREÇO COMERCIAL
// ============================================================================

/**
 * EmpresaEnderecoComercialResponseDto
 * Retornado pelo backend após criar, editar ou buscar o endereço comercial.
 */
export interface EmpresaEnderecoComercialResponseDto {
  idEnderecoComercial: number;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  nomeFantasiaEmpresa: string;
}

/**
 * EmpresaEnderecoComercialRequestDto
 * Payload para POST e PUT de endereço comercial.
 * No PUT, o idEmpresa não é necessário (a URL já identifica o endereço).
 * Para o POST, o idEmpresa deve ser preenchido com o retorno do POST de empresa.
 */
export interface EmpresaEnderecoComercialRequestDto {
  idEmpresa: number;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;         // 2 caracteres (UF)
  cep: string;            // 8 dígitos, sem hífen
}
