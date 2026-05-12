// ============================================================
// REUNIAO-CC.MODEL
//
// Contratos de dados do módulo de Reuniões C+C (bilaterais).
//
// Referência de API: Guia Frontend — Reuniões CC.md
// ============================================================

// ============================================================
// ENUMS (type aliases)
// ============================================================

export type TipoReuniaoCC = 'PRESENCIAL' | 'ONLINE';

export type StatusReuniao =
  | 'PENDENTE'
  | 'REAGENDADA'
  | 'CANCELADA'
  | 'REALIZADA'
  | 'CANCELADA_POR_NAO_VALIDACAO';

export type MotivoReagendamento =
  | 'COMPROMISSO_PROFISSIONAL_INADIAVEL'
  | 'IMPREVISTO_PESSOAL_FAMILIAR'
  | 'PROBLEMA_DE_SAUDE'
  | 'DIFICULDADE_LOGISTICA'
  | 'CONFLITO_DE_AGENDA'
  | 'REAGENDAMENTO_ALINHADO'
  | 'OUTRO';

export type OpcaoTangibilidade =
  | 'CONEXAO_GERADA'
  | 'PARCERIA_FIRMADA'
  | 'APRESENTACAO_REALIZADA'
  | 'PROPOSTA_ENVIADA'
  | 'CONTRATO_ASSINADO'
  | 'REUNIAO_AGENDADA'
  | 'INDICACAO_RECEBIDA'
  | 'INDICACAO_FEITA'
  | 'CONHECIMENTO_COMPARTILHADO'
  | 'OUTRO';

// ============================================================
// RESPONSE DTOs — dados lidos da API
// ============================================================

export interface ReuniaoCCTangibilidadeResponseDto {
  idTangibilidade: number;
  opcao: OpcaoTangibilidade;
  opcaoDescricao: string;
  descricaoOutro: string | null;
}

export interface ReuniaoCCProspectResponseDto {
  idProspect: number;
  nomeProspect: string;
  nomeEmpresa: string;
}

export interface ReuniaoCCValidacaoResponseDto {
  idValidacao: number;
  nomeAssociado: string;
  nenhumaPossibilidadeProspect: boolean;
  validadoEm: string;
  prospects: ReuniaoCCProspectResponseDto[];
  tangibilidades: ReuniaoCCTangibilidadeResponseDto[];
}

export interface ReuniaoCCReagendamentoResponseDto {
  idReagendamento: number;
  nomeSolicitante: string;
  motivo: MotivoReagendamento;
  motivoDescricao: string;
  motivoTexto: string | null;
  novaDataHora: string | null; // null = foi cancelamento, não reagendamento
  registradoEm: string;
}

export interface ReuniaoCCResponseDto {
  idReuniao: number;
  nomeAssociado1: string;
  nomeAssociado2: string;
  dataHora: string;
  tipo: TipoReuniaoCC;
  tipoDescricao: string;
  local: string | null;
  status: StatusReuniao;
  statusDescricao: string;
  criadoEm: string;
  atualizadoEm: string | null;
  jaValidadaPorMim: boolean;
  reagendamentos: ReuniaoCCReagendamentoResponseDto[];
  validacoes: ReuniaoCCValidacaoResponseDto[];
}

// ============================================================
// REQUEST DTOs — dados enviados para a API
// ============================================================

export interface AgendarReuniaoRequestDto {
  idAssociado2: number;
  dataHora: string;
  tipo: TipoReuniaoCC;
  local: string | null; // null para ONLINE; obrigatório para PRESENCIAL
}

export interface ReagendarCancelarRequestDto {
  motivo: MotivoReagendamento;
  motivoTexto: string | null; // obrigatório apenas quando motivo = 'OUTRO'
  novaDataHora: string | null; // null = cancelamento; preenchido = reagendamento
}

export interface ProspectRequestDto {
  nomeProspect: string;
  nomeEmpresa: string;
}

export interface TangibilidadeRequestDto {
  opcao: OpcaoTangibilidade;
  descricaoOutro: string | null; // obrigatório apenas quando opcao = 'OUTRO'
}

export interface ValidarReuniaoRequestDto {
  nenhumaPossibilidadeProspect: boolean;
  prospects: ProspectRequestDto[];
  tangibilidades: TangibilidadeRequestDto[];
}
