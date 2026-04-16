/**
 * ASSOCIADO-CARGO.MODEL.TS
 * DTOs para o módulo de Cargos de Liderança do Associado
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Regras de negócio:
 * - Todo associado deve ter ao menos 1 cargo ativo.
 * - Múltiplos cargos simultâneos são permitidos.
 * - Não pode haver dois cargos ATIVOS com o mesmo idCargoLideranca para o mesmo associado.
 * - Para desativar: PUT com ativo: false e dataFim preenchida.
 * - classificacaoFinanceira é visível APENAS para ADM (controlar no template).
 *
 * Endpoints cobertos:
 *   GET  /api/v1/associados-cargos/associado/{id} → AssociadoCargoLiderancaResponseDto[]
 *   POST /api/v1/associados-cargos                → AssociadoCargoLiderancaRequestDto
 *   PUT  /api/v1/associados-cargos/{id}           → AssociadoCargoLiderancaRequestDto
 */

// ============================================================================
// RESPONSE DTO (leitura)
// ============================================================================

/**
 * AssociadoCargoLiderancaResponseDto
 * Retornado ao listar cargos do associado (ativos e históricos).
 */
export interface AssociadoCargoLiderancaResponseDto {
  idAssociadoCargo: number;
  nomeAssociado: string;
  nomeCargo: string;
  classificacaoFinanceira: string;  // 'NORMAL' | 'ISENTO' — visível só para ADM
  dataInicio: string;               // yyyy-MM-dd
  dataFim: string | null;           // null = cargo em vigor (indeterminado)
  ativo: boolean;
}

// ============================================================================
// REQUEST DTO (escrita: POST e PUT)
// ============================================================================

/**
 * AssociadoCargoLiderancaRequestDto
 * Payload para designar (POST) ou editar/encerrar (PUT) um cargo.
 * Para encerrar: enviar ativo: false e dataFim preenchida com a data de hoje.
 */
export interface AssociadoCargoLiderancaRequestDto {
  idAssociado: number;
  idCargoLideranca: number;
  dataInicio: string;               // yyyy-MM-dd
  dataFim: string | null;           // null = indeterminado
  ativo: boolean;
}
