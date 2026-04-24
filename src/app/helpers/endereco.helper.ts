/**
 * ENDERECO.HELPER.TS
 *
 * Funções puras de formatação de endereço.
 *
 * Segue CLAUDE.md SEÇÃO 2.1 (Separação de Responsabilidades):
 * - Helpers: funções puras de utilidade (formatação, cálculo, máscara)
 * - Proibido: efeitos colaterais, acesso a services, estado global
 *
 * Funções exportadas:
 *   formatarEnderecoCompleto()     → formata LocalPresencialResponseDto (equipes)
 *   formatarEnderecoResidencial()  → formata EnderecoResidencialResponseDto (associados)
 *
 * Por que duas funções em vez de uma genérica?
 *   Os dois DTOs diferem no campo de UF: LocalPresencial usa `uf`, enquanto
 *   EnderecoResidencial usa `estado`. Uma função genérica exigiria uma
 *   interface intermediária que não agrega legibilidade ao código consumidor.
 *   Duas funções pequenas são mais claras e mais fáceis de manter.
 */

import { LocalPresencialResponseDto } from '../models/equipe.model';
import { EnderecoResidencialResponseDto } from '../models/associado.model';

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

/**
 * formatarEnderecoResidencial()
 *
 * Mesma lógica de formatarEnderecoCompleto(), mas para
 * EnderecoResidencialResponseDto, cujo campo de UF é `estado` (não `uf`).
 *
 * Saída exemplo:
 *   "Rua das Flores, 100 — Apto 42, Centro, São Paulo — SP, CEP 01310-100"
 */
export function formatarEnderecoResidencial(endereco: EnderecoResidencialResponseDto): string {
  let logradouro = `${endereco.rua}, ${endereco.numero}`;
  if (endereco.complemento) {
    logradouro += ` — ${endereco.complemento}`;
  }

  const segmentos: string[] = [
    logradouro,
    endereco.bairro,
    `${endereco.cidade} — ${endereco.estado}`,
    `CEP ${endereco.cep}`,
  ];

  return segmentos.filter(Boolean).join(', ');
}
