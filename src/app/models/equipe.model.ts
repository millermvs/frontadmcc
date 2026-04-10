/**
 * EQUIPE.MODEL.TS
 * DTOs para o módulo de Equipes
 *
 * Segue CLAUDE.md SEÇÃO 6 (Padrões de Models):
 * - Interfaces puras (sem lógica, sem métodos)
 * - RequestDto ≠ ResponseDto
 * - Type aliases espelham os enums do backend (Java UPPER_CASE)
 *
 * Endpoints:
 *   POST /api/v1/equipes/cadastrar     → EquipeRequestDto (inclui localPresencial quando ≠ ONLINE)
 *   GET  /api/v1/locais-presenciais/equipe/{id} → LocalPresencialResponseDto
 *   PUT  /api/v1/locais-presenciais/{id}        → LocalPresencialRequestDto (edição)
 */

// ============================================================================
// TYPE ALIASES (espelham os enums Java do backend)
// ============================================================================

/**
 * DiaReuniao
 * Valores exatos como o backend Java aceita (SCREAMING_CASE, sem acento).
 * No template: use LABELS_DIAS_REUNIAO para exibir ao usuário.
 */
export type DiaReuniao = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA';

/**
 * ModeloReuniao
 * 'ONLINE' desativa a seção de endereço presencial no formulário.
 * 'PRESENCIAL' desativa o campo de link Zoom.
 * 'HIBRIDO' exige ambos.
 */
export type ModeloReuniao = 'HIBRIDO' | 'ONLINE' | 'PRESENCIAL';

/**
 * StatusEquipe
 * Valores em formato de exibição conforme contrato com o backend.
 * Atenção: se o backend serializar o enum Java como SCREAMING_CASE (ex: 'ATIVA'),
 * atualize estes valores e ajuste classeStatus() e os filtros do template.
 */
export type StatusEquipe = 'ATIVA' | 'EM_FORMACAO' | 'INATIVA';

// ============================================================================
// DTOS — ENDPOINT 1: POST /api/v1/equipes/cadastrar
// ============================================================================

/**
 * EquipeRequestDto
 *
 * Payload único para o endpoint de criação.
 * O campo localPresencial é enviado apenas quando modeloReuniao ≠ ONLINE.
 * O backend usa @Transactional — ou equipe + endereço são gravados juntos, ou nada é gravado.
 */
export interface EquipeRequestDto {
  nomeEquipe: string;
  dataInicioFormacao: string | null;    // yyyy-MM-dd. Null → backend defaulta para hoje
  dataEfetivaLancamento: string | null; // yyyy-MM-dd. Null no cadastro inicial
  diaReuniao: DiaReuniao | null;        // null → @NotNull do backend valida corretamente
  horarioReuniao: string | null;        // HH:mm:ss. null → @NotNull do backend valida
  modeloReuniao: ModeloReuniao | null;  // null → @NotNull do backend valida
  linkReuniaoOnline: string | null;
  localPresencial: LocalPresencialSemIdDto | null; // null quando modeloReuniao === 'ONLINE'
}

// ============================================================================
// DTOS — ENDPOINT 2: POST /api/v1/locais-presenciais
// ============================================================================

/**
 * LocalPresencialRequestDto
 *
 * Enviado para o segundo endpoint APÓS obter o idEquipe da resposta do primeiro.
 * O service preenche o idEquipe automaticamente — o componente nunca manipula isso.
 */
export interface LocalPresencialRequestDto {
  idEquipe: number;   // Preenchido pelo service com o retorno do POST de equipe
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;         // 2 caracteres. Ex: "SP"
  cep: string;        // Ex: "01311-100"
}

/**
 * LocalPresencialSemIdDto
 *
 * Versão do DTO sem idEquipe para uso no formulário.
 * O componente usa este tipo nos seus campos — o service completa com o ID
 * após receber a resposta do primeiro endpoint.
 *
 * Por que Omit? Evita que o template acidentalmente preencha o idEquipe
 * (que só existe após o POST do primeiro endpoint).
 */
export type LocalPresencialSemIdDto = Omit<LocalPresencialRequestDto, 'idEquipe'>;

// ============================================================================
// DTOS — RESPOSTA: GET /api/v1/locais-presenciais/equipe/{id}
// ============================================================================

/**
 * LocalPresencialResponseDto
 *
 * O que o backend retorna ao buscar o local presencial de uma equipe.
 * Presente no EquipeResponseDto (resposta do cadastro/busca) e no GET do endpoint de locais.
 * Inclui o idLocalPresencial para uso no PUT de edição.
 */
export interface LocalPresencialResponseDto {
  idLocalPresencial: number;
  idEquipe: number;
  nomeEquipe: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;   // 2 caracteres. Ex: "SP"
  cep: string;  // Ex: "01311-100"
}

// ============================================================================
// DTOS — RESPOSTA: GET/POST /api/v1/equipes
// ============================================================================

/**
 * EquipeResponseDto
 *
 * O que o backend retorna após criar ou buscar uma equipe.
 * NÃO herda de EquipeRequestDto (os campos do response são diferentes).
 * Para equipes PRESENCIAL/HIBRIDO, localPresencial vem preenchido no mesmo payload.
 */
export interface EquipeResponseDto {
  idEquipe: number;
  nomeEquipe: string;
  dataInicioFormacao: string;           // yyyy-MM-dd
  dataPrevisaoLancamento: string;       // yyyy-MM-dd (backend calcula: início + 63 dias)
  dataEfetivaLancamento: string | null; // null enquanto não lançada
  diaReuniao: DiaReuniao;
  horarioReuniao: string;
  modeloReuniao: ModeloReuniao;
  linkReuniaoOnline: string | null;
  statusEquipe: StatusEquipe;
  numeroComponentes: number;            // Calculado pelo backend (só associados Ativos)
  pontuacaoMensal: number;
  localPresencial: LocalPresencialResponseDto | null; // null quando modeloReuniao === 'ONLINE'
  criadoEm: string;                     // ISO 8601: yyyy-MM-ddTHH:mm:ssZ
  atualizadoEm: string;
}

// ============================================================================
// PAGINAÇÃO (genérico — usado por todos os módulos)
// ============================================================================

export interface PaginacaoResponseDto<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  ultimaPagina: boolean;
}

// ============================================================================
// CONSTANTES E LABELS (para uso no template)
// ============================================================================

/**
 * Lista de dias para o <select> do formulário.
 * valor → o que vai para o backend | label → o que o usuário vê.
 */
export const DIAS_REUNIAO: Array<{ valor: DiaReuniao; label: string }> = [
  { valor: 'TERCA', label: 'Terça-feira' },
  { valor: 'QUARTA', label: 'Quarta-feira' },
  { valor: 'QUINTA', label: 'Quinta-feira' },
  { valor: 'SEXTA', label: 'Sexta-feira' },
];

/**
 * Lista de modelos para o <select> do formulário.
 */
export const MODELOS_REUNIAO: Array<{ valor: ModeloReuniao; label: string }> = [
  { valor: 'HIBRIDO', label: 'Híbrido (1ª e 3ª presencial, demais online)' },
  { valor: 'ONLINE', label: '100% Online' },
  { valor: 'PRESENCIAL', label: '100% Presencial' },
];

/**
 * Horários disponíveis para seleção.
 * Formato HH:mm:ss conforme esperado pelo backend.
 */
export const HORARIOS_DISPONIVEIS: string[] = [
  '08:00:00', '09:00:00', '10:00:00', '11:00:00',
  '13:00:00', '14:00:00', '15:00:00', '16:00:00',
  '17:00:00', '18:00:00', '19:00:00', '20:00:00',
];

/**
 * Lista de status para o <select> do formulário e filtros.
 * valor → o que vai para o backend | label → o que o usuário vê.
 * Atenção: se o backend serializar o enum Java como SCREAMING_CASE (ex: 'ATIVA'),
 * atualize estes valores e ajuste classeStatus() e os filtros do template.
 */
export const STATUS_EQUIPE: Array<{ valor: StatusEquipe; label: string }> = [
  { valor: 'ATIVA', label: 'Ativa' },
  { valor: 'EM_FORMACAO', label: 'Em formação' },
  { valor: 'INATIVA', label: 'Inativa' },
];

/**
 * Labels de exibição para DiaReuniao (backend → usuário).
 * Uso: LABELS_DIA[equipe.diaReuniao] → "Terça-feira"
 */
export const LABELS_DIA: Record<DiaReuniao, string> = {
  SEGUNDA: 'Segunda-feira',
  TERCA: 'Terça-feira',
  QUARTA: 'Quarta-feira',
  QUINTA: 'Quinta-feira',
  SEXTA: 'Sexta-feira',
};

/**
 * Labels de exibição para ModeloReuniao (backend → usuário).
 * Uso: LABELS_MODELO[equipe.modeloReuniao] → "Híbrido"
 */
export const LABELS_MODELO: Record<ModeloReuniao, string> = {
  HIBRIDO: 'Híbrido',
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
};

/**
 * Labels de exibição para horário (remove o :ss do backend para exibição).
 * Uso: LABELS_HORARIO['19:00:00'] → '19:00'
 */
export const LABELS_HORARIO: Record<string, string> = Object.fromEntries(
  HORARIOS_DISPONIVEIS.map(h => [h, h.substring(0, 5)])
);

/**
 * Labels de exibição para StatusEquipe (backend → usuário).
 * Uso: LABELS_STATUS[equipe.statusEquipe] → "Ativa"
 *
 * IMPORTANTE: se o backend serializar o enum Java como SCREAMING_CASE (ex: 'ATIVA'),
 * atualize estes valores e ajuste classeStatus() e os filtros do template.
 */
export const LABELS_STATUS: Record<StatusEquipe, string> = {
  ATIVA: 'Ativa',
  EM_FORMACAO: 'Em formação',
  INATIVA: 'Inativa',
};
