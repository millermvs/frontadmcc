/**
 * ASSOCIADO-ANUIDADE.MODEL.TS
 * DTOs para os módulos de Anuidades e Renovações do Associado
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Regras de negócio:
 * - Unicidade por (associado + anoReferencia): sem duplicatas por ano. Retorna 409 se tentar.
 * - dataPagamento e valorPago são obrigatórios apenas se statusAnuidade = 'PAGO'.
 * - Renovações são criadas automaticamente via PATCH /renovar-anuidade — não há POST manual.
 * - A tela de Renovações é somente leitura (apenas GET).
 *
 * Endpoints cobertos:
 *   POST /api/v1/associados-anuidades              → AssociadoAnuidadeRequestDto
 *   PUT  /api/v1/associados-anuidades/{id}         → AssociadoAnuidadeRequestDto
 *   GET  /api/v1/associados-anuidades/associado/{id} → AssociadoAnuidadeResponseDto[]
 *   GET  /api/v1/associados-renovacoes/associado/{id}→ AssociadoRenovacaoResponseDto[]
 */

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * StatusAnuidade
 * PAGO → requer dataPagamento e valorPago.
 * ISENTO → automático quando cargo tem classificacaoFinanceira = 'ISENTO'.
 */
export type StatusAnuidade = 'AGUARDANDO' | 'PAGO' | 'ISENTO';

// ============================================================================
// ANUIDADES — RESPONSE DTO (leitura)
// ============================================================================

/**
 * AssociadoAnuidadeResponseDto
 * Retornado ao listar anuidades do associado.
 */
export interface AssociadoAnuidadeResponseDto {
  idAnuidade: number;
  idAssociado: number;
  nomeAssociado: string;
  anoReferencia: number;
  statusAnuidade: StatusAnuidade;
  dataPagamento: string | null;   // yyyy-MM-dd — preenchido apenas para PAGO
  valorPago: number | null;       // BigDecimal → number. Positivo.
  observacao: string | null;
  criadoEm: string;               // yyyy-MM-ddTHH:mm:ss
  atualizadoEm: string;
}

// ============================================================================
// ANUIDADES — REQUEST DTO (escrita: POST e PUT)
// ============================================================================

/**
 * AssociadoAnuidadeRequestDto
 * Payload para cadastrar ou editar uma anuidade avulsa.
 */
export interface AssociadoAnuidadeRequestDto {
  idAssociado: number;
  anoReferencia: number;
  statusAnuidade: StatusAnuidade;
  dataPagamento: string | null;   // obrigatório se statusAnuidade = 'PAGO'
  valorPago: number | null;       // opcional, deve ser positivo
  observacao: string | null;      // máx 200 chars
}

// ============================================================================
// RENOVAÇÕES — RESPONSE DTO (somente leitura)
// ============================================================================

/**
 * AssociadoRenovacaoResponseDto
 * Retornado ao listar renovações do associado (mais recentes primeiro).
 * Criadas automaticamente via PATCH /renovar-anuidade — sem criação manual.
 */
export interface AssociadoRenovacaoResponseDto {
  idRenovacao: number;
  idAssociado: number;
  nomeAssociado: string;
  dataVencimentoAnterior: string; // yyyy-MM-dd
  dataVencimentoNova: string;     // yyyy-MM-dd
  dataPagamento: string;          // yyyy-MM-dd
  idRegistradoPor: number;
  nomeRegistradoPor: string;
  registradoEm: string;           // yyyy-MM-ddTHH:mm:ss
}
