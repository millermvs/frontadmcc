// Espelho dos ResponseDtos do backend

export interface EquipeResponseDto {
  idEquipe: number;
  nomeEquipe: string;
  statusEquipe: string;
  diaReuniao: string;
  horarioReuniao: string;
  modeloReuniao: string;
  linkReuniaoOnline: string | null;
  dataInicioFormacao: string;       // ISO 8601 (yyyy-MM-dd)
  dataPrevisaoLancamento: string;   // ISO 8601 (yyyy-MM-dd)
  dataEfetivaLancamento: string | null; // ISO 8601 (yyyy-MM-dd) ou null
}

export interface PaginacaoResponseDto<T> {
  conteudo: T[];
  numeroPagina: number;
  tamanhoPagina: number;
  totalElementos: number;
  totalPaginas: number;
  ultimaPagina: boolean;
}

export interface EquipeRequestDto {
  nomeEquipe: string;
  statusEquipe: string;
  diaReuniao: string;
  horarioReuniao: string;
  modeloReuniao: string;
  linkReuniaoOnline?: string;
  dataInicioFormacao: string;
  dataPrevisaoLancamento?: string;
  dataEfetivaLancamento?: string;
}
