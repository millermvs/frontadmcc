/**
 * ASSOCIADO-GRUPAMENTO.MODEL.TS
 * DTOs para o módulo de Grupamentos Estratégicos do Associado
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Regras de negócio:
 * - Um associado pode estar em múltiplos grupamentos simultaneamente.
 * - Grupamentos são independentes do Cluster e da Atuação Específica.
 * - Para desvincular: PUT com ativo: false e dataFim preenchida.
 * - Vinculação editável pela ADM e pelos Diretores.
 *
 * Endpoints cobertos:
 *   GET  /api/v1/associados-grupamentos/associado/{id} → AssociadoGrupamentoResponseDto[]
 *   POST /api/v1/associados-grupamentos                → AssociadoGrupamentoRequestDto
 *   PUT  /api/v1/associados-grupamentos/{id}           → AssociadoGrupamentoRequestDto
 */

// ============================================================================
// RESPONSE DTO (leitura)
// ============================================================================

/**
 * AssociadoGrupamentoResponseDto
 * Retornado ao listar grupamentos vinculados ao associado.
 */
export interface AssociadoGrupamentoResponseDto {
  idAssociadoGrupamento: number;
  nomeAssociado: string;
  nomeGrupamento: string;
  sigla: string;          // até 4 caracteres
  dataInicio: string;     // yyyy-MM-dd
  dataFim: string | null; // null = vínculo ativo (indeterminado)
  ativo: boolean;
}

// ============================================================================
// REQUEST DTO (escrita: POST e PUT)
// ============================================================================

/**
 * AssociadoGrupamentoRequestDto
 * Payload para vincular (POST) ou editar/desvincular (PUT) um grupamento.
 * Para desvincular: enviar ativo: false e dataFim preenchida com a data de hoje.
 */
export interface AssociadoGrupamentoRequestDto {
  idAssociado: number;
  idGrupamento: number;
  dataInicio: string;     // yyyy-MM-dd
  dataFim: string | null; // null = indeterminado
  ativo: boolean;
}
