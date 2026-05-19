// ============================================================
// PARCERIA.MODEL
//
// Contratos de dados do módulo de Parcerias.
//
// Seguindo CLAUDE.md (Padrões de Models):
// - Interfaces puras (sem lógica, sem métodos)
// - Dois DTOs: ResponseDto (leitura) e RequestDto (escrita)
// - Datas como string ISO 8601
//
// Referência de API: Guia Frontend — Parcerias.md
// ============================================================

// ============================================================
// REQUEST DTO
// ============================================================

/**
 * ParceriaRequestDto
 *
 * Body enviado no POST /api/v1/parcerias.
 * Contém apenas o destinatário — o remetente é extraído do JWT
 * pelo backend e nunca deve ser informado no body.
 */
export interface ParceriaRequestDto {
  idDestinatario: number;
}

// ============================================================
// RESPONSE DTO
// ============================================================

/**
 * ParceriaResponseDto
 *
 * Retornado pelo POST /api/v1/parcerias (201 Created) e pelos
 * itens de GET /api/v1/parcerias/minhas (dentro de PaginacaoResponseDto).
 *
 * A listagem agrega os dois papéis do associado autenticado:
 * pode aparecer como nomeRemetente (declarou a parceria) ou como
 * nomeDestinatario (recebeu a declaração de outro associado).
 *
 * mesCompetencia: sempre "YYYY-MM-01" — primeiro dia do mês de apuração.
 * Ao formatar, usar new Date(mesCompetencia + 'T12:00:00') para evitar
 * deslocamento de fuso horário (UTC vs America/Sao_Paulo).
 */
export interface ParceriaResponseDto {
  idParceria: number;
  nomeRemetente: string;
  nomeDestinatario: string;
  criadoEm: string;       // "YYYY-MM-DDTHH:mm:ss"
  idCiclo: number;
  mesCompetencia: string; // "YYYY-MM-DD" — sempre dia 01
}
