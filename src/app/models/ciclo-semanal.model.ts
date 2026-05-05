// ============================================================
// CICLO-SEMANAL.MODEL
//
// Contrato de dados do domínio Ciclos Semanais.
// ============================================================

/**
 * CicloSemanalResponseDto
 *
 * Formato retornado por GET /api/v1/ciclos-semanais/equipe/{idEquipe}.
 *
 * mesCompetencia: date ISO 8601 no formato yyyy-MM-dd — formatar no componente.
 * dataInicio / dataEncerramento: datetime ISO 8601 — formatar no componente.
 */
export interface CicloSemanalResponseDto {
  idCiclo: number;
  idEquipe: number;
  nomeEquipe: string;
  dataInicio: string;
  dataEncerramento: string;
  mesCompetencia: string;
  ativo: boolean;
}
