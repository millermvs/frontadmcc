// ============================================================
// cargo-lideranca.model.ts
// ============================================================
// Contratos de dados para o módulo Cargos de Liderança.
//
// Separação obrigatória:
//   ResponseDto → o que a API retorna (campos "resolvidos")
//   RequestDto  → o que enviamos para a API (POST / PUT)
//
// Enums modelados como type alias (não enum TypeScript) para
// evitar overhead de runtime e manter compatibilidade com o JSON.
// ============================================================

// ── Type aliases (enums de domínio) ─────────────────────────

/** Controla isenção de anuidade. Sempre obrigatório na API. */
export type ClassificacaoFinanceira = 'NORMAL' | 'ISENTO';

/**
 * Define o nível de acesso ao sistema.
 * null = cargo sem permissão especial (apenas associado operacional).
 * 'DIRETOR'  = acesso de validação de presença e designação.
 * 'ADM_CC'   = acesso total ao painel administrativo.
 */
export type CategoriaPermissao = 'DIRETOR' | 'ADM_CC';

// ── Response DTO — leitura ───────────────────────────────────

export interface CargoLiderancaResponseDto {
  idCargoLideranca: number;
  nomeCargo: string;
  classificacaoFinanceira: ClassificacaoFinanceira;
  categoriaPermissao: CategoriaPermissao | null;
  ativo: boolean;
}

// ── Request DTO — escrita (POST e PUT) ──────────────────────
// PUT de inativação: enviar os mesmos campos com ativo: false.
// Não existe DELETE neste domínio.

export interface CargoLiderancaRequestDto {
  nomeCargo: string;
  classificacaoFinanceira: ClassificacaoFinanceira;
  categoriaPermissao: CategoriaPermissao | null;
  ativo: boolean;
}

