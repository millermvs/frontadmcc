/**
 * ASSOCIADO.MODEL.TS
 * DTOs para o módulo de Associados
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 * - Type aliases espelham os enums do backend (Java UPPER_CASE)
 *
 * Endpoints cobertos:
 *   POST   /api/v1/associados                            → AssociadoRequestDto
 *   PUT    /api/v1/associados/{id}                       → AssociadoRequestDto
 *   GET    /api/v1/associados  (paginado)                → PaginacaoResponseDto<AssociadoResponseDto>
 *   GET    /api/v1/associados/{id}                       → AssociadoResponseDto
 *   PATCH  /api/v1/associados/{id}/alterar-status        → AssociadoAlterarStatusRequestDto
 *   PATCH  /api/v1/associados/{id}/renovar-anuidade      → AssociadoRenovarAnuidadeRequestDto
 *   GET    /api/v1/associados/{id}/historico-status      → AssociadoStatusHistoricoResponseDto[]
 *   GET    /api/v1/enderecos-residenciais/associado/{id} → EnderecoResidencialResponseDto[]
 *   POST   /api/v1/enderecos-residenciais/associado/{id} → EnderecoResidencialRequestDto
 *   PUT    /api/v1/enderecos-residenciais/{id}           → EnderecoResidencialRequestDto
 */

// ============================================================================
// TYPE ALIASES (espelham os enums Java do backend)
// ============================================================================

/**
 * StatusAssociado
 * Os 7 estados possíveis do ciclo de vida de um associado.
 * Apenas ADM altera o status — nunca ocorre automaticamente.
 */
export type StatusAssociado =
  | 'PREATIVO'
  | 'ATIVO'
  | 'INATIVO_PAUSA_PROGRAMADA'
  | 'INATIVO_DESISTENCIA'
  | 'INATIVO_FALECIMENTO'
  | 'INATIVO_DESLIGADO'
  | 'INATIVO_OUTRO';

/**
 * TipoOrigemEquipe
 * Define se o associado ingressou na equipe original ou foi transferido.
 */
export type TipoOrigemEquipe = 'ORIGINAL' | 'COLABORATIVA';

// ============================================================================
// CONSTANTES E LABELS (para uso no template e filtros)
// ============================================================================

/**
 * Mapa enum → label legível para exibição no template.
 * Uso: LABELS_STATUS_ASSOCIADO['PREATIVO'] → 'Pré-ativo'
 */
export const LABELS_STATUS_ASSOCIADO: Record<StatusAssociado, string> = {
  PREATIVO:                 'Pré-ativo',
  ATIVO:                    'Ativo',
  INATIVO_PAUSA_PROGRAMADA: 'Inativo — Pausa programada',
  INATIVO_DESISTENCIA:      'Inativo — Desistência',
  INATIVO_FALECIMENTO:      'Inativo — Falecimento',
  INATIVO_DESLIGADO:        'Inativo — Desligado',
  INATIVO_OUTRO:            'Inativo — Outro',
};

/**
 * Lista para popular o <select> de status nos filtros e no modal de alterar status.
 */
export const STATUS_ASSOCIADO_OPCOES: Array<{ valor: StatusAssociado; label: string }> = [
  { valor: 'PREATIVO',                 label: 'Pré-ativo' },
  { valor: 'ATIVO',                    label: 'Ativo' },
  { valor: 'INATIVO_PAUSA_PROGRAMADA', label: 'Inativo — Pausa programada' },
  { valor: 'INATIVO_DESISTENCIA',      label: 'Inativo — Desistência' },
  { valor: 'INATIVO_FALECIMENTO',      label: 'Inativo — Falecimento' },
  { valor: 'INATIVO_DESLIGADO',        label: 'Inativo — Desligado' },
  { valor: 'INATIVO_OUTRO',            label: 'Inativo — Outro' },
];

/**
 * Lista para popular o <select> de origem de equipe.
 */
export const TIPOS_ORIGEM_EQUIPE: Array<{ valor: TipoOrigemEquipe; label: string }> = [
  { valor: 'ORIGINAL',     label: 'Original' },
  { valor: 'COLABORATIVA', label: 'Colaborativa' },
];

// ============================================================================
// ASSOCIADO — RESPONSE DTO (leitura)
// ============================================================================

/**
 * AssociadoResponseDto
 *
 * Retornado pelo backend no GET, POST e PUT.
 * Campos de vínculo chegam como NOMES (ex: nomeEquipe), nunca como IDs avulsos.
 */
export interface AssociadoResponseDto {
  idAssociado: number;
  nomeCompleto: string;
  cpf: string;
  emailPrincipal: string;
  telefonePrincipal: string;
  dataNascimento: string;                    // yyyy-MM-dd
  dataIngresso: string;                      // yyyy-MM-dd
  dataVencimento: string | null;             // null quando associado é isento
  tipoOrigemEquipe: TipoOrigemEquipe;
  statusAssociado: StatusAssociado;
  dataInicioPausa: string | null;            // preenchido apenas para INATIVO_PAUSA_PROGRAMADA
  dataPrevisaoRetorno: string | null;        // preenchido apenas para INATIVO_PAUSA_PROGRAMADA
  dataPagamentoPrimeiraAnuidade: string | null;
  motivoStatusInativo: string | null;        // preenchido para DESISTENCIA e DESLIGADO

  // ── Vínculos: ID + nome sempre juntos ──────────────────────
  // Os 5 campos Long adicionados ao ResponseDto do backend (Decisão 1).
  // Permitem popular selects no modal de edição sem precisar de match por nome.
  idPadrinho: number | null;                 // null quando não há padrinho
  nomePadrinho: string | null;

  idEquipeOrigem: number;                    // imutável após o cadastro
  nomeEquipeOrigem: string;

  idEquipeAtual: number;                     // equipe atual, editável
  nomeEquipe: string;

  idCluster: number;
  nomeCluster: string;

  idAtuacaoEspecifica: number;
  nomeAtuacaoEspecifica: string;

  criadoEm: string;                          // yyyy-MM-ddTHH:mm:ss
  atualizadoEm: string;
}

// ============================================================================
// ASSOCIADO — REQUEST DTO (escrita: POST e PUT)
// ============================================================================

/**
 * AssociadoRequestDto
 *
 * Payload para POST /api/v1/associados e PUT /api/v1/associados/{id}.
 *
 * Regras de negócio embutidas no contrato:
 * - No cadastro: statusAssociado deve sempre ser 'PREATIVO' (preencher no código, nunca exibir).
 * - No cadastro: idEquipe e idEquipeOrigem recebem o MESMO valor (usuário escolhe 1 equipe).
 * - Na edição: idEquipeOrigem é enviado com o valor original sem alteração.
 * - O backend calcula dataVencimento automaticamente a partir de dataIngresso.
 * - CEP, CPF e telefone: enviar APENAS dígitos, sem máscara.
 */
export interface AssociadoRequestDto {
  // ── Dados pessoais ────────────────────────────────────────
  nomeCompleto: string;
  cpf: string;                      // 11 dígitos, sem pontuação
  emailPrincipal: string;
  telefonePrincipal: string;        // 10 ou 11 dígitos
  dataNascimento: string;           // yyyy-MM-dd

  // ── Dados administrativos ─────────────────────────────────
  dataIngresso: string;             // yyyy-MM-dd, não pode ser futura
  dataPagamentoPrimeiraAnuidade: string | null;
  tipoOrigemEquipe: TipoOrigemEquipe;
  statusAssociado: StatusAssociado; // Sempre 'PREATIVO' no cadastro

  // ── Vínculos ──────────────────────────────────────────────
  idEquipeAtual: number;                 // equipe atual
  idEquipeOrigem: number;           // no cadastro = mesmo que idEquipe
  idCluster: number;
  idAtuacaoEspecifica: number;
  idPadrinho: number | null;

  // ── Cargo inicial ─────────────────────────────────────────
  idCargoLideranca: number;
  dataInicioCargo: string;          // yyyy-MM-dd, não pode ser futura

  // ── Visibilidade ──────────────────────────────────────────
  exibirAniversario: boolean;       // default: false

  // ── Endereço residencial (embutido no cadastro) ───────────
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;                   // UF — 2 caracteres (ex: "SP")
  cep: string;                      // 8 dígitos, sem hífen
}

// ============================================================================
// ALTERAR STATUS — REQUEST DTO
// ============================================================================

/**
 * AssociadoAlterarStatusRequestDto
 *
 * Payload para PATCH /api/v1/associados/{id}/alterar-status.
 *
 * Campos condicionais por status:
 *   INATIVO_PAUSA_PROGRAMADA → dataInicioPausa + dataPrevisaoRetorno obrigatórios
 *   INATIVO_DESISTENCIA      → motivo obrigatório
 *   INATIVO_DESLIGADO        → motivo obrigatório
 *   Demais                   → sem campos extras (enviar null nos condicionais)
 */
export interface AssociadoAlterarStatusRequestDto {
  statusNovo: StatusAssociado;
  motivo: string | null;
  dataInicioPausa: string | null;
  dataPrevisaoRetorno: string | null;
  idRegistradoPor: number;          // idAssociado do usuário logado (via AuthService)
}

// ============================================================================
// RENOVAR ANUIDADE — REQUEST DTO
// ============================================================================

/**
 * AssociadoRenovarAnuidadeRequestDto
 *
 * Payload para PATCH /api/v1/associados/{id}/renovar-anuidade.
 * Não permitido para PREATIVO nem para associados isentos (retorna 422).
 */
export interface AssociadoRenovarAnuidadeRequestDto {
  dataPagamento: string;            // yyyy-MM-dd
}

// ============================================================================
// EDITAR EQUIPE — REQUEST DTO
// ============================================================================

/**
 * AssociadoEditarEquipeRequestDto
 *
 * Payload para PUT /api/v1/associados/{id}/equipe.
 * DTO intencional e mínimo: a transferência de equipe é uma ação focada,
 * separada do PUT geral para evitar que campos irrelevantes afetem
 * o log e a rastreabilidade da operação.
 */
export interface AssociadoEditarEquipeRequestDto {
  idEquipe: number;
}

// ============================================================================
// HISTÓRICO DE STATUS — RESPONSE DTO
// ============================================================================

/**
 * AssociadoStatusHistoricoResponseDto
 *
 * Retornado por GET /api/v1/associados/{id}/historico-status (mais recentes primeiro).
 */
export interface AssociadoStatusHistoricoResponseDto {
  idStatusHistorico: number;
  idAssociado: number;
  nomeAssociado: string;
  statusAnterior: string;
  statusNovo: string;
  motivo: string | null;
  dataInicioPausa: string | null;
  dataPrevisaoRetorno: string | null;
  idRegistradoPor: number;
  nomeRegistradoPor: string;
  registradoEm: string;             // yyyy-MM-ddTHH:mm:ss
}

// ============================================================================
// ENDEREÇO RESIDENCIAL
// ============================================================================

/**
 * EnderecoResidencialResponseDto
 *
 * Retornado por GET /api/v1/enderecos-residenciais/associado/{idAssociado}.
 */
export interface EnderecoResidencialResponseDto {
  idEndereco: number;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  nomeAssociado: string;
}

/**
 * EnderecoResidencialRequestDto
 *
 * Payload para POST /api/v1/enderecos-residenciais/associado/{idAssociado}
 * e PUT /api/v1/enderecos-residenciais/{id}.
 * O idAssociado vai na URL (não no body) — por isso não está neste DTO.
 */
export interface EnderecoResidencialRequestDto {
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;                   // 2 caracteres (UF)
  cep: string;                      // 8 dígitos, sem hífen
}

// ============================================================================
// VISIBILIDADE — RESPONSE DTO
// ============================================================================

/**
 * AssociadoVisibilidadeResponseDto
 *
 * Retornado por GET /api/v1/visibilidades/associado/{idAssociado}.
 * Controla quais dados do associado ficam visíveis para toda a rede.
 * Gerenciado pela ADM e pelo próprio associado (via toggle).
 */
export interface AssociadoVisibilidadeResponseDto {
  idVisibilidade: number;
  exibirAniversario: boolean;        // exibe DD/MM do aniversário para toda a rede
  exibirEnderecoComercial: boolean;  // exibe endereço comercial para toda a rede
}
