// Espelho dos ResponseDtos do backend

export interface PaginacaoResponseDto<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
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
