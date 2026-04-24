/**
 * TOAST.SERVICE.TS
 * Serviço singleton para exibição de notificações flutuantes.
 *
 * Segue CLAUDE.md SEÇÃO 5 (Padrões de Services):
 * - Singleton via @Injectable({ providedIn: 'root' })
 * - Sem dependência de UI: o componente ToastComponent é quem renderiza
 * - Estado gerenciado via signal (reativo, sem Subject/BehaviorSubject)
 *
 * Tipos disponíveis: 'sucesso' | 'erro' | 'aviso'
 * Uso por enquanto: apenas sucesso().
 * Os métodos erro() e aviso() estão prontos mas não invocados —
 * erros continuam exibidos inline dentro das modais.
 */
import { Injectable, signal } from '@angular/core';

// ============================================================================
// TIPOS
// ============================================================================

export type TipoToast = 'sucesso' | 'erro' | 'aviso';

export interface ToastState {
  mensagem: string;
  tipo: TipoToast;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable({ providedIn: 'root' })
export class ToastService {

  // Signal privado mutável — só o service escreve
  private readonly _estado = signal<ToastState | null>(null);

  // Signal público somente-leitura — componentes leem
  readonly toast = this._estado.asReadonly();

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  /**
   * sucesso(mensagem, duracao?)
   * Exibe o toast verde. Desaparece após `duracao` ms (padrão: 3000).
   *
   * Uso: this.toastService.sucesso('Associado ativado com sucesso!');
   */
  sucesso(mensagem: string, duracao = 3000): void {
    this._exibir({ mensagem, tipo: 'sucesso' }, duracao);
  }

  /**
   * erro(mensagem, duracao?)
   * Exibe o toast vermelho. Duração padrão maior (4000ms) — erros
   * merecem um pouco mais de tempo de leitura.
   *
   * Reservado para erros globais que não pertencem a nenhuma modal.
   * Erros de formulário continuam exibidos inline dentro das modais.
   */
  erro(mensagem: string, duracao = 4000): void {
    this._exibir({ mensagem, tipo: 'erro' }, duracao);
  }

  /**
   * aviso(mensagem, duracao?)
   * Exibe o toast amarelo para alertas não-bloqueantes.
   */
  aviso(mensagem: string, duracao = 3500): void {
    this._exibir({ mensagem, tipo: 'aviso' }, duracao);
  }

  // =========================================================================
  // MÉTODO PRIVADO
  // =========================================================================

  /**
   * _exibir(estado, duracao)
   * Ponto único de escrita no signal. Centraliza o setTimeout de limpeza
   * para que os métodos públicos não repitam a mesma lógica.
   */
  private _exibir(estado: ToastState, duracao: number): void {
    this._estado.set(estado);
    setTimeout(() => this._estado.set(null), duracao);
  }
}
