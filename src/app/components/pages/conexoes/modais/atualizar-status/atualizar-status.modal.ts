/**
 * ATUALIZAR-STATUS.MODAL.TS
 *
 * Modal de atualização de status de uma conexão RECEBIDA.
 * Aberta via ModalService.open(AtualizarStatusModal, { data: { conexao, novoStatus } }).
 *
 * Fluxo:
 *   1. Página passa { conexao, novoStatus } via ModalService.dados()
 *   2. Modal exibe card de contexto + formulário condicional por novoStatus
 *   3. PATCH em ConexaoService.atualizarStatus(id, dto)
 *   4. Sucesso → modalService.fechar(conexaoAtualizada)
 *   5. Página recebe o DTO atualizado e substitui o item no signal local
 *      (sem recarregar a lista inteira)
 *
 * Formulário condicional:
 *   EM_ANDAMENTO → sem campos (apenas confirmação textual)
 *   FECHADA      → valorNegocio (number, obrigatório, > 0)
 *   NAO_FECHADA  → motivoNaoFechado (select, obrigatório, 3 opções fixas)
 *
 * Segue CLAUDE.md §4.5 (ModalService), §8 (Formulários), §8.3 (erro no footer).
 */
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../../../core/modal.service';
import {
  AtualizarStatusRequestDto,
  ConexaoRecebidaResponseDto,
  MotivoNaoFechado,
  StatusConexao,
} from '../../../../../models/conexao.model';
import { ConexaoService } from '../../../../../services/conexao.service';

@Component({
  selector: 'app-atualizar-status-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './atualizar-status.modal.html',
  styleUrl:    './atualizar-status.modal.css',
})
export class AtualizarStatusModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService   = inject(ModalService);
  private conexaoService = inject(ConexaoService);
  private fb             = inject(FormBuilder);

  // =========================================================================
  // DADOS RECEBIDOS DA PÁGINA
  //
  // A página passa { conexao, novoStatus } via ModalService.open(…, { data }).
  // Lemos com dados<T>() — sem @Input() no template, sem prop drilling.
  // =========================================================================

  private readonly _dados = this.modalService.dados<{
    conexao:    ConexaoRecebidaResponseDto;
    novoStatus: StatusConexao;
  }>();

  readonly conexao    = this._dados.conexao;
  readonly novoStatus = this._dados.novoStatus;

  // =========================================================================
  // FORMULÁRIO
  //
  // Ambos os campos começam sem validadores — adicionados no ngOnInit
  // conforme o novoStatus recebido. Assim o form.valid reflete corretamente
  // apenas o campo exibido, sem precisar de lógica manual no template.
  // =========================================================================

  form = this.fb.group({
    valorNegocio:     [null as number | null, []],
    motivoNaoFechado: ['' as string,          []],
  });

  // =========================================================================
  // SIGNALS — ESTADO GERAL
  // =========================================================================

  carregando = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // LOOKUP TABLES (labels e opções)
  // =========================================================================

  readonly LABEL_NOVO_STATUS: Record<StatusConexao, string> = {
    NOVA:         'Nova',
    EM_ANDAMENTO: 'Em Andamento',
    FECHADA:      'Fechado',
    NAO_FECHADA:  'Não Fechado',
  };

  readonly LABEL_STATUS_ATUAL: Record<StatusConexao, string> = {
    NOVA:         'Nova',
    EM_ANDAMENTO: 'Em Andamento',
    FECHADA:      'Fechado',
    NAO_FECHADA:  'Não Fechado',
  };

  readonly MOTIVOS: Array<{ valor: MotivoNaoFechado; label: string }> = [
    { valor: 'CLIENTE_NAO_RESPONDEU', label: 'Cliente não respondeu' },
    { valor: 'NAO_E_O_PERFIL',        label: 'Não é o perfil que procuro' },
    { valor: 'NEGOCIO_NAO_AVANCOU',   label: 'Negócio não avançou' },
  ];

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    // Aplica validador apenas no campo relevante para o novoStatus.
    // Os outros campos ficam sem validador, portanto não bloqueiam o form.valid.
    if (this.novoStatus === 'FECHADA') {
      this.form.get('valorNegocio')!.setValidators([Validators.required]);
      this.form.get('valorNegocio')!.updateValueAndValidity();
    }
    if (this.novoStatus === 'NAO_FECHADA') {
      this.form.get('motivoNaoFechado')!.setValidators([Validators.required]);
      this.form.get('motivoNaoFechado')!.updateValueAndValidity();
    }
    // EM_ANDAMENTO: nenhum campo obrigatório — form.valid = true desde o início.
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  confirmar(): void {
    if (this.form.invalid || this.carregando()) return;

    this.carregando.set(true);

    const dto: AtualizarStatusRequestDto = { status: this.novoStatus };

    if (this.novoStatus === 'FECHADA') {
      // type="number" pode retornar string no FormBuilder — Number() garante o tipo.
      dto.valorNegocio = Number(this.form.get('valorNegocio')!.value);
    }
    if (this.novoStatus === 'NAO_FECHADA') {
      dto.motivoNaoFechado = this.form.get('motivoNaoFechado')!.value as MotivoNaoFechado;
    }

    this.conexaoService
      .atualizarStatus(this.conexao.idConexao, dto)
      .subscribe({
        next: (atualizada: ConexaoRecebidaResponseDto) => {
          this.carregando.set(false);
          this.modalService.fechar(atualizada);
        },
        error: (err: HttpErrorResponse) => {
          this.carregando.set(false);
          const mensagem =
            err.error?.message ??
            (err.status === 0
              ? 'Servidor indisponível. Verifique sua conexão.'
              : 'Erro ao atualizar status. Tente novamente.');
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
  // HELPERS VISUAIS
  //
  // Retornam classes CSS calculadas aqui — não no template (CLAUDE.md §2.2).
  // =========================================================================

  /**
   * classeIconeHeader()
   *
   * Mapeia novoStatus → classe CSS do ícone no header.
   * Cada variante tem cor própria (azul / verde / vermelho).
   */
  classeIconeHeader(): string {
    const mapa: Record<StatusConexao, string> = {
      NOVA:         'asm-header-icon asm-header-icon--andamento',
      EM_ANDAMENTO: 'asm-header-icon asm-header-icon--andamento',
      FECHADA:      'asm-header-icon asm-header-icon--fechada',
      NAO_FECHADA:  'asm-header-icon asm-header-icon--nao-fechada',
    };
    return mapa[this.novoStatus];
  }

  /**
   * iconeHeader()
   *
   * Bootstrap Icon para o novoStatus.
   */
  iconeHeader(): string {
    const mapa: Record<StatusConexao, string> = {
      NOVA:         'bi-arrow-right-circle-fill',
      EM_ANDAMENTO: 'bi-arrow-right-circle-fill',
      FECHADA:      'bi-check-circle-fill',
      NAO_FECHADA:  'bi-x-circle-fill',
    };
    return mapa[this.novoStatus];
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
