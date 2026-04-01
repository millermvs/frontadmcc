// Espelho dos ResponseDtos do backend

export interface PaginacaoResponseDto<T> {
  conteudo: T[];
  numeroPagina: number;
  tamanhoPagina: number;
  totalElementos: number;
  totalPaginas: number;
  ultimaPagina: boolean;
}

export interface AssociadoResponseDto {
  idAssociado: number;
  nomeCompleto: string;
  cpf: string;
  emailPrincipal: string;
  telefonePrincipal: string;
  dataNascimento: string;      // ISO 8601 (yyyy-MM-dd)
  dataIngresso: string;        // ISO 8601 (yyyy-MM-dd)
  dataVencimento: string;      // ISO 8601 (yyyy-MM-dd)
  statusAtivo: boolean;
  nomeEquipeAtual: string;
  nomeCluster: string;
  nomeAtuacaoEspecifica: string;
  tipoOrigemEquipe?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface AssociadoRequestDto {
  nomeCompleto: string;
  cpf: string;
  emailPrincipal: string;
  telefonePrincipal: string;
  dataNascimento: string;
  dataIngresso: string;
  idEquipeAtual: number;
  idCluster: number;
  idAtuacaoEspecifica: number;
  statusAtivo?: boolean;
  tipoOrigemEquipe?: string;
  idEquipeOrigem?: number;
  idPadrinho?: number;
}

export interface EnderecoResidencialResponseDto {
  idEndereco: number;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  nomeAssociado: string;
}

export interface EnderecoResidencialRequestDto {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  idAssociado: number;
}
