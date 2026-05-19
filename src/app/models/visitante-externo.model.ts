// ============================================================
// VISITANTE-EXTERNO.MODEL
//
// Contratos de dados do módulo de Visitante Externo.
//
// Seguindo CLAUDE.md (Padrões de Models):
// - Interfaces puras (sem lógica, sem métodos)
// - Dois DTOs: RequestDto (escrita) e ResponseDto (leitura)
// - Datas como string ISO 8601
//
// Referência de API: Guia Frontend — Visitante Externo.md
// ============================================================

// ============================================================
// TYPE ALIAS
// ============================================================

/**
 * StatusVisitante
 *
 * Espelha o enum Java StatusVisitante do backend.
 * AGUARDANDO_VALIDACAO é o único estado não-terminal.
 * VALIDADO e NAO_VALIDADO são terminais — sem retorno.
 */
export type StatusVisitante =
  | 'AGUARDANDO_VALIDACAO'
  | 'VALIDADO'
  | 'NAO_VALIDADO';

// ============================================================
// REQUEST DTO
// ============================================================

/**
 * VisitanteExternoRequestDto
 *
 * Body enviado no POST /api/v1/visitantes-externos.
 * Não incluir cpfResponsavel (extraído do JWT pelo backend)
 * nem idCiclo (resolvido internamente pelo backend a partir da equipe).
 *
 * cpf: enviar apenas os 11 dígitos numéricos, sem máscara.
 * telefone: enviar apenas dígitos, sem máscara.
 * empresa: enviar null quando o visitante não tiver vínculo empresarial.
 * dataReuniao: formato "YYYY-MM-DD".
 */
export interface VisitanteExternoRequestDto {
  nomeCompleto: string;
  cpf: string;
  empresa: string | null;
  telefone: string;
  dataReuniao: string;
  idEquipe: number;
}

// ============================================================
// RESPONSE DTO
// ============================================================

/**
 * VisitanteExternoResponseDto
 *
 * Retornado pelo POST /api/v1/visitantes-externos (201 Created),
 * GET /api/v1/visitantes-externos/{id} (200 OK) e como item de
 * GET /api/v1/visitantes-externos?idEquipe=X (dentro de PaginacaoResponseDto).
 *
 * nomeValidadoPor e validadoEm chegam null enquanto
 * status === 'AGUARDANDO_VALIDACAO'. Não renderizar esses campos quando null.
 */
export interface VisitanteExternoResponseDto {
  idVisitanteExterno: number;
  nomeCompleto: string;
  cpf: string;
  empresa: string | null;
  telefone: string;
  dataReuniao: string;              // "YYYY-MM-DD"
  status: StatusVisitante;
  criadoEm: string;                 // "YYYY-MM-DDTHH:mm:ss"
  nomeResponsavel: string;
  nomeEquipe: string;
  nomeValidadoPor: string | null;
  validadoEm: string | null;        // "YYYY-MM-DDTHH:mm:ss" — null enquanto aguardando
}

// ============================================================
// CONSTANTES E LABELS (para uso no template)
// ============================================================

/**
 * Labels de exibição para StatusVisitante (backend → usuário).
 * Uso: LABELS_STATUS_VISITANTE[visitante.status] → "Aguardando Validação"
 */
export const LABELS_STATUS_VISITANTE: Record<StatusVisitante, string> = {
  AGUARDANDO_VALIDACAO: 'Aguardando Validação',
  VALIDADO: 'Validado',
  NAO_VALIDADO: 'Não Validado',
};
