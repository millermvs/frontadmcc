// Espelho dos ResponseDtos do backend

export interface PaginacaoResponseDto<T> {
  conteudo: T[];
  numeroPagina: number;
  tamanhoPagina: number;
  totalElementos: number;
  totalPaginas: number;
  ultimaPagina: boolean;
}

export interface ClusterResponseDto {
  idCluster: number;
  nome: string;
}

export interface ClusterRequestDto {
  nome: string;
}

export interface AtuacaoEspecificaResponseDto {
  id: number;
  nome: string;
  nomeCluster: string;
  idCluster: number;
}

export interface AtuacaoEspecificaRequestDto {
  nome: string;
  idCluster: number;
}
