/**
 * ENDERECO.HELPER.TS
 *
 * Funções puras de formatação de endereço.
 *
 * Segue CLAUDE.md SEÇÃO 2.1 (Separação de Responsabilidades):
 * - Helpers: funções puras de utilidade (formatação, cálculo, máscara)
 * - Proibido: efeitos colaterais, acesso a services, estado global
 *
 * Uso:
 *   import { formatarEnderecoCompleto } from '../../../helpers/endereco.helper';
 *   const texto = formatarEnderecoCompleto(enderecoAtual());
 */

import { LocalPresencialResponseDto } from '../models/equipe.model';

/**
 * formatarEnderecoCompleto()
 *
 * Transforma um LocalPresencialResponseDto em uma string legível e copiável.
 *
 * Saída exemplo:
 *   "Av. Paulista, 1000 — Sala 500, Bela Vista, São Paulo — SP, CEP 01311-100"
 *
 * Lógica:
 *   - logradouro: rua + número (sempre presentes) + complemento (se existir)
 *   - bairro
 *   - cidade + UF
 *   - CEP
 * Os segmentos são unidos por ", " para facilitar a leitura e o uso em formulários.
 */
export function formatarEnderecoCompleto(endereco: LocalPresencialResponseDto): string {
  let logradouro = `${endereco.rua}, ${endereco.numero}`;
  if (endereco.complemento) {
    logradouro += ` — ${endereco.complemento}`;
  }

  const segmentos: string[] = [
    logradouro,
    endereco.bairro,
    `${endereco.cidade} — ${endereco.uf}`,
    `CEP ${endereco.cep}`,
  ];

  return segmentos.filter(Boolean).join(', ');
}
