/**
 * PAGINACAO.MODEL.TS
 *
 * Contrato genérico de paginação — fonte única de verdade no frontend.
 * Espelha o PaginacaoResponseDto<T> do backend (br.com.admcc.domain.dtos.response).
 *
 * Usado por TODOS os services que fazem GET paginado. Se o contrato do backend
 * mudar, só este arquivo precisa ser atualizado — os services e models consomem
 * a interface diretamente.
 *
 * Contrato de request (não modelado aqui pois vai como HttpParams):
 *   ?page=<int zero-based>&size=<int>
 *
 * Contrato de response (modelado abaixo):
 *   { items, page, size, totalItems, totalPages, hasNext, hasPrevious }
 *
 * Simetria importante: o nome "page" é usado nos dois lados (request e response),
 * alinhado com o padrão Spring Data do backend.
 */

export interface PaginacaoResponseDto<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
