/**
 * CONFIRMAR-EXCLUSAO.MODAL.TS
 *
 * Modal de confirmação antes de excluir uma conexão GERADA.
 * Aberto via ModalService.open(ConfirmarExclusaoModal, { data: { conexao } }).
 *
 * Regra de negócio (PRD §2.8):
 *   Exclusão permitida APENAS enquanto status = "Nova".
 *   Sem justificativa — o botão simplesmente não aparece em outros status.
 *
 * Fluxo:
 *   1. Página passa { conexao } via ModalService.dados()
 *   2. Modal exibe card de contexto + aviso irreversível
 *   3. DELETE em ConexaoService.excluir(id) → 204 void
 *   4. Sucesso → modalService.fechar(conexao.idConexao)
 *   5. Página recebe o id e remove o item do signal conexoesGeradas
 *      (sem recarregar a lista inteira)
 *
 * Não há formulário — é uma confirmação simples.
 * Segue CLAUDE.md §4.5 (ModalService) e §8.3 (erro no footer).
 */
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { ModalService } from '../../../../../core/modal.service';
import { ConexaoGeradaResponseDto } from '../../../../../models/conexao.model';
import { ConexaoService } from '../../../../../services/conexao.service';

@Component({
  selector: 'app-confirmar-exclusao-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmar-exclusao.modal.html',
  styleUrl:    './confirmar-exclusao.modal.css',
})
export class ConfirmarExclusaoModal {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService   = inject(ModalService);
  private conexaoService = inject(ConexaoService);

  // =========================================================================
  // DADOS RECEBIDOS DA PÁGINA
  // =========================================================================

  readonly conexao = this.modalService.dados<{ conexao: ConexaoGeradaResponseDto }>().conexao;

  // =========================================================================
  // SIGNALS — ESTADO
  // =========================================================================

  carregando = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // AÇÃO — EXCLUIR
  // =========================================================================

  /**
   * excluir()
   *
   * Chama DELETE /conexoes/{id}.
   * O backend retorna 204 (void) — o frontend fecha o modal com o id
   * para que a página remova o item do signal local.
   */
  excluir(): void {
    if (this.carregando()) return;

    this.carregando.set(true);

    this.conexaoService.excluir(this.conexao.idConexao).subscribe({
      next: () => {
        this.carregando.set(false);
        this.modalService.fechar(this.conexao.idConexao);
      },
      error: (err: HttpErrorResponse) => {
        this.carregando.set(false);
        const mensagem =
          err.error?.message ??
          (err.status === 0
            ? 'Servidor indisponível. Verifique sua conexão.'
            : 'Erro ao excluir conexão. Tente novamente.');
        this._mostrarErroNaModal(this.erroModal, mensagem);
      },
    });
  }

  // =========================================================================
  // CANCELAR / FECHAR
  // =========================================================================

  fechar(): void {
    if (this.carregando()) return;
    this.modalService.fechar(undefined);
  }

  // =========================================================================
  // HELPERS PRIVADOS
  // =========================================================================

  /** Padrão CLAUDE.md §8.3 — erro no footer com auto-dismiss de 3 segundos. */
  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }
}
