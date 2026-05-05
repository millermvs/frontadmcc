// ============================================================
// CONEXAO.MODEL
//
// Contratos de dados do módulo de Conexões (Fase 4 — Operacional).
//
// Seguindo CLAUDE.md SEÇÃO 6 (Padrões de Models):
// - Interfaces puras (sem lógica, sem métodos)
// - Dois DTOs por entidade: ResponseDto (leitura) ≠ RequestDto (escrita)
// - Datas como string ISO 8601
// - Type aliases para enums (union literal)
//
// Referência de API: guia-frontend-conexoes.md
// ============================================================

// ============================================================
// ENUMS (type aliases)
// ============================================================

/**
 * TipoConexao
 * Intensidade da indicação feita pelo remetente.
 *
 * Usar `tipo` para lógica de comparação no código.
 * Usar `tipoDescricao` (vindo do ResponseDto) para exibição na UI.
 */
export type TipoConexao = 'QUENTE' | 'MORNA' | 'FRIA';

/**
 * StatusConexao
 * Ciclo de vida de uma conexão, controlado exclusivamente pelo destinatário.
 *
 * Transições permitidas pelo backend:
 *   NOVA → EM_ANDAMENTO | FECHADA | NAO_FECHADA
 *   EM_ANDAMENTO → FECHADA | NAO_FECHADA
 *   FECHADA e NAO_FECHADA são terminais — sem retorno.
 */
export type StatusConexao = 'NOVA' | 'EM_ANDAMENTO' | 'FECHADA' | 'NAO_FECHADA';

/**
 * MotivoNaoFechado
 * Obrigatório quando status → NAO_FECHADA.
 * Exatamente 3 opções válidas (validadas também no backend).
 */
export type MotivoNaoFechado =
  | 'CLIENTE_NAO_RESPONDEU'
  | 'NAO_E_O_PERFIL'
  | 'NEGOCIO_NAO_AVANCOU';

// ============================================================
// RESPONSE DTOs — dados lidos da API
// ============================================================

/**
 * ConexaoGeradaResponseDto
 *
 * Formato retornado pelo endpoint GET /conexoes/geradas e pelo
 * POST /conexoes (criação). Perspectiva do REMETENTE.
 *
 * Campos resolvidos pelo backend:
 * - nomeDestinatario (em vez de idDestinatario)
 * - tipoDescricao / statusDescricao (rótulos legíveis para exibição)
 */
export interface ConexaoGeradaResponseDto {
  idConexao: number;
  nomeDestinatario: string;
  nomeCandidato: string;
  telefoneCandidato: string;
  tipo: TipoConexao;
  tipoDescricao: string;
  complemento: string | null;
  status: StatusConexao;
  statusDescricao: string;
  valorNegocio: number | null;
  criadoEm: string;           // ISO 8601 — formatar no componente
  prazoEstourado: boolean;    // true = conexão aberta há > 90 dias → badge laranja
}

/**
 * ConexaoRecebidaResponseDto
 *
 * Formato retornado pelo endpoint GET /conexoes/recebidas e pelo
 * PATCH /conexoes/{id}/status (após atualização). Perspectiva do DESTINATÁRIO.
 *
 * Diferença em relação ao Gerada:
 * - nomeRemetente (em vez de nomeDestinatario)
 * - motivoNaoFechado + motivoNaoFechadoDescricao (preenchidos quando NAO_FECHADA)
 */
export interface ConexaoRecebidaResponseDto {
  idConexao: number;
  nomeRemetente: string;
  nomeCandidato: string;
  telefoneCandidato: string;
  tipo: TipoConexao;
  tipoDescricao: string;
  complemento: string | null;
  status: StatusConexao;
  statusDescricao: string;
  valorNegocio: number | null;
  motivoNaoFechado: MotivoNaoFechado | null;
  motivoNaoFechadoDescricao: string | null;
  criadoEm: string;           // ISO 8601 — formatar no componente
  prazoEstourado: boolean;
}

/**
 * ConexaoResumoResponseDto
 *
 * Agregação retornada pelos endpoints GET /conexoes/geradas/resumo
 * e GET /conexoes/recebidas/resumo.
 *
 * valorTotalNegocio é sempre um number (COALESCE no backend garante
 * que nunca chega null, mesmo quando nenhum negócio foi fechado).
 */
export interface ConexaoResumoResponseDto {
  totalConexoes: number;
  totalNovas: number;
  totalEmAndamento: number;
  totalFechadas: number;
  totalNaoFechadas: number;
  valorTotalNegocio: number;
}

// ============================================================
// REQUEST DTOs — dados enviados para a API
// ============================================================

/**
 * ConexaoRequestDto
 *
 * Body do POST /conexoes (registrar nova conexão).
 * Remetente é extraído do JWT pelo backend — não precisa enviar.
 */
export interface ConexaoRequestDto {
  idDestinatario: number;
  tipo: TipoConexao;
  nomeCandidato: string;
  telefoneCandidato: string;
  complemento?: string;       // opcional, máx 130 chars
}

/**
 * AtualizarStatusRequestDto
 *
 * Body do PATCH /conexoes/{id}/status.
 * Campos condicionais:
 * - valorNegocio: obrigatório APENAS quando status = FECHADA
 * - motivoNaoFechado: obrigatório APENAS quando status = NAO_FECHADA
 * A validação final é feita pelo backend (422 se violada).
 */
export interface AtualizarStatusRequestDto {
  status: StatusConexao;
  valorNegocio?: number;
  motivoNaoFechado?: MotivoNaoFechado;
}
