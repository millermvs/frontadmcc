/**
 * PERFIL-ASSOCIADO.MODEL.TS
 * DTOs para o módulo Perfil C+C
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 *
 * Regras de negócio:
 * - O perfil é a vitrine pública do associado na rede.
 * - Editável pelo próprio associado no APP, e pelo ADM no painel.
 * - Campos automáticos (cluster, equipe, status, cargo) vêm preenchidos pelo backend.
 * - perfilCompleto = true apenas quando todos os campos obrigatórios estão preenchidos.
 *
 * Endpoints cobertos:
 *   POST /api/v1/perfis                  → PerfilAssociadoRequestDto
 *   PUT  /api/v1/perfis/{id}             → PerfilAssociadoRequestDto
 *   GET  /api/v1/perfis/associado/{id}   → PerfilAssociadoResponseDto
 *   GET  /api/v1/perfis/{id}             → PerfilAssociadoResponseDto
 */

// ============================================================================
// RESPONSE DTO (leitura)
// ============================================================================

/**
 * PerfilAssociadoResponseDto
 * Retornado pelo backend ao buscar ou criar/editar o perfil.
 * Inclui campos automáticos derivados da Fase 1 (cluster, equipe, cargo, etc.).
 */
export interface PerfilAssociadoResponseDto {
  idPerfil: number;
  idAssociado: number;

  // ── Campos editáveis pelo associado ──────────────────────
  fotoProfissional: string;
  nomeProfissional: string;           // máx 40 chars
  nomeEmpresa: string;                // máx 80 chars
  logomarcaEmpresa: string | null;
  telefonePrincipal: string;          // formato: 55 (DDD) 99999-9999
  telefoneSecundario: string | null;
  email: string;                      // máx 60 chars
  site: string | null;                // máx 60 chars
  linkedIn: string | null;            // máx 60 chars
  instagram: string | null;           // máx 60 chars
  youTube: string | null;             // máx 60 chars
  outraRedeSocial: string | null;     // máx 60 chars
  oQueFaco: string;                   // máx 200 chars
  publicoIdeal: string;               // máx 150 chars
  principalProblemaResolvo: string;   // máx 200 chars
  conexoesEstrategicas: string;       // máx 150 chars
  interessesPessoais: string;         // máx 200 chars

  // ── Campos automáticos (Fase 1 — somente leitura) ────────
  nomeCluster: string;
  nomeAtuacaoEspecifica: string;
  nomeEquipe: string;
  nomeCargoAtual: string;
  statusAssociado: string;
  dataIngresso: string;               // yyyy-MM-dd
  dataVencimento: string | null;      // null se isento

  // ── Metadados ─────────────────────────────────────────────
  perfilCompleto: boolean;
  criadoEm: string;                   // yyyy-MM-ddTHH:mm:ss
  atualizadoEm: string;
}

// ============================================================================
// REQUEST DTO (escrita: POST e PUT)
// ============================================================================

/**
 * PerfilAssociadoRequestDto
 * Payload para criar (POST) ou editar (PUT) o perfil.
 * Campos automáticos (cluster, equipe, etc.) NÃO são enviados aqui — o backend os preenche.
 */
export interface PerfilAssociadoRequestDto {
  idAssociado: number;

  // ── Obrigatórios ──────────────────────────────────────────
  fotoProfissional: string;
  nomeProfissional: string;           // máx 40 chars
  nomeEmpresa: string;                // máx 80 chars
  telefonePrincipal: string;
  email: string;                      // máx 60 chars, formato e-mail
  oQueFaco: string;                   // máx 200 chars
  publicoIdeal: string;               // máx 150 chars
  principalProblemaResolvo: string;   // máx 200 chars
  conexoesEstrategicas: string;       // máx 150 chars
  interessesPessoais: string;         // máx 200 chars

  // ── Opcionais ─────────────────────────────────────────────
  logomarcaEmpresa: string | null;
  telefoneSecundario: string | null;
  site: string | null;                // máx 60 chars
  linkedIn: string | null;            // máx 60 chars
  instagram: string | null;           // máx 60 chars
  youTube: string | null;             // máx 60 chars
  outraRedeSocial: string | null;     // máx 60 chars
}
