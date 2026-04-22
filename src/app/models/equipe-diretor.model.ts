/**
 * EQUIPE-DIRETOR.MODEL.TS
 * DTOs para Diretor de Equipe (DE) e Diretor de Território (DT).
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Regras de negócio:
 * - DE e DT são entidades distintas — não passam pelo catálogo CargoLideranca.
 * - Cada cargo tem vigência: dataInicio obrigatória, dataFim null = indeterminado.
 * - Promoção de DT1→DT2: encerra o registro atual (PUT com dataFim) e cria novo.
 *   Nunca edite o nivel diretamente no registro ativo.
 * - Pode haver DT1, DT2 e DT3 simultaneamente na mesma equipe.
 *
 * Endpoints cobertos:
 *   POST /api/v1/diretores-equipe                  → EquipeDiretorEquipeRequestDto
 *   GET  /api/v1/diretores-equipe/equipe/{id}      → EquipeDiretorEquipeResponseDto[]
 *   PUT  /api/v1/diretores-equipe/{id}             → EquipeDiretorEquipeRequestDto
 *
 *   POST /api/v1/diretores-territorio              → EquipeDiretorTerritorioRequestDto
 *   GET  /api/v1/diretores-territorio/equipe/{id}  → EquipeDiretorTerritorioResponseDto[]
 *   PUT  /api/v1/diretores-territorio/{id}         → EquipeDiretorTerritorioRequestDto
 */

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * NivelDiretorTerritorio
 * Enum de nivel enviado exatamente como string (conforme backend):
 * 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'
 *
 * Exibição sugerida: "Nível 1 (DT1)", "Nível 2 (DT2)", "Nível 3 (DT3)".
 */
export type NivelDiretorTerritorio = 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3';

/**
 * LABELS_NIVEL
 * Mapa de exibição para o select e para a tabela de histórico.
 * Ex: LABELS_NIVEL['NIVEL_1'] → 'Nível 1 (DT1)'
 */
export const LABELS_NIVEL: Record<NivelDiretorTerritorio, string> = {
  NIVEL_1: 'Nível 1 (DT1)',
  NIVEL_2: 'Nível 2 (DT2)',
  NIVEL_3: 'Nível 3 (DT3)',
};

/**
 * NIVEIS_TERRITORIO
 * Array ordenado de todos os níveis disponíveis — usado para iterar no select.
 */
export const NIVEIS_TERRITORIO: NivelDiretorTerritorio[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3'];

// ============================================================================
// DIRETOR DE EQUIPE (DE)
// ============================================================================

/**
 * EquipeDiretorEquipeResponseDto
 * Retornado nos endpoints GET por ID e GET por equipe.
 */
export interface EquipeDiretorEquipeResponseDto {
  idDiretorEquipe: number;
  idEquipe:        number;
  nomeEquipe:      string;
  idAssociado:     number;
  nomeAssociado:   string;
  dataInicio:      string;       // yyyy-MM-dd
  dataFim:         string | null; // null = vigência indeterminada
}

/**
 * EquipeDiretorEquipeRequestDto
 * Payload para POST (designar) e PUT (editar / encerrar vigência).
 * Para encerrar: enviar dataFim preenchida com a data de encerramento.
 */
export interface EquipeDiretorEquipeRequestDto {
  idEquipe:    number;
  idAssociado: number;
  dataInicio:  string;       // yyyy-MM-dd
  dataFim:     string | null;
}

// ============================================================================
// DIRETOR DE TERRITÓRIO (DT)
// ============================================================================

/**
 * EquipeDiretorTerritorioResponseDto
 * Retornado nos endpoints GET por ID e GET por equipe.
 */
export interface EquipeDiretorTerritorioResponseDto {
  idDiretorTerritorio: number;
  idEquipe:            number;
  nomeEquipe:          string;
  idAssociado:         number;
  nomeAssociado:       string;
  nivel:               NivelDiretorTerritorio;
  dataInicio:          string;       // yyyy-MM-dd
  dataFim:             string | null; // null = vigência indeterminada
}

/**
 * EquipeDiretorTerritorioRequestDto
 * Payload para POST (designar) e PUT (editar / encerrar vigência).
 * O campo nivel deve ser enviado exatamente como string: 'NIVEL_1', 'NIVEL_2' ou 'NIVEL_3'.
 * Nunca edite o nivel diretamente — encerre o vínculo atual e crie um novo.
 */
export interface EquipeDiretorTerritorioRequestDto {
  idEquipe:    number;
  idAssociado: number;
  nivel:       NivelDiretorTerritorio;
  dataInicio:  string;       // yyyy-MM-dd
  dataFim:     string | null;
}
