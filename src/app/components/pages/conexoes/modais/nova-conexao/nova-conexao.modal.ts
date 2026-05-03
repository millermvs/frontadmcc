/**
 * NOVA-CONEXAO.MODAL.TS
 *
 * Modal de criação de nova conexão (indicação de negócio).
 * Aberta via ModalService.open(NovaConexaoModal) — sem @Input() no template.
 *
 * Fluxo:
 *   1. Usuário preenche destinatário (autocomplete) + tipo + candidato
 *   2. POST em ConexaoService.registrar(dto)
 *   3. Sucesso → this.modalService.fechar(novaConexao)
 *   4. Página recebe o resultado e recarrega aba Geradas
 *
 * Autocomplete de destinatário:
 *   - Subject interno alimenta pipe debounceTime(300) + switchMap
 *   - Busca apenas associados ATIVO (filtro enviado ao backend)
 *   - Mínimo 2 caracteres para disparar a busca
 *   - Ao selecionar, o ID é salvo no form; o campo de texto torna-se readonly
 *
 * Segue CLAUDE.md §4.5 (Serviço de Modal) e §8 (Formulários e Validação).
 */
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ModalService } from '../../../../../core/modal.service';
import { AssociadoResponseDto } from '../../../../../models/associado.model';
import { ConexaoGeradaResponseDto, TipoConexao } from '../../../../../models/conexao.model';
import { AssociadoService } from '../../../../../services/associado.service';
import { ConexaoService } from '../../../../../services/conexao.service';

@Component({
  selector: 'app-nova-conexao-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './nova-conexao.modal.html',
  styleUrl: './nova-conexao.modal.css',
})
export class NovaConexaoModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService     = inject(ModalService);
  private conexaoService   = inject(ConexaoService);
  private associadoService = inject(AssociadoService);
  private fb               = inject(FormBuilder);
  private destroyRef       = inject(DestroyRef);

  // =========================================================================
  // FORMULÁRIO
  //
  // idDestinatario é number no form — nunca string.
  // O campo de texto visível (termoBuscaDestinatario) é um signal separado,
  // pois o usuário digita para buscar mas o valor enviado ao backend é o ID.
  // =========================================================================

  form = this.fb.group({
    idDestinatario:    [null as number | null, Validators.required],
    tipo:              ['' as string,          Validators.required],
    nomeCandidato:     ['',                    Validators.required],
    telefoneCandidato: ['',                    Validators.required],
    complemento:       ['',                    Validators.maxLength(130)],
  });

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE DESTINATÁRIO
  // =========================================================================

  termoBuscaDestinatario  = signal('');
  sugestoes               = signal<AssociadoResponseDto[]>([]);
  destinatarioSelecionado = signal<AssociadoResponseDto | null>(null);
  buscandoDestinatario    = signal(false);
  mostrarSugestoes        = signal(false);

  // Subject interno que alimenta o pipe de autocomplete.
  // Usando Subject + pipe em vez de effect/computed porque a origem dos dados
  // é uma operação assíncrona cancelável — exatamente o caso de uso do switchMap.
  private _busca$ = new Subject<string>();

  // =========================================================================
  // SIGNALS — ESTADO GERAL
  // =========================================================================

  carregando = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    // Pipe de autocomplete: aguarda 300ms sem digitação → cancela request anterior
    // → filtra termos < 2 chars → busca no backend → atualiza sugestões
    this._busca$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(termo => termo.length >= 2),
      tap(() => this.buscandoDestinatario.set(true)),
      switchMap(termo =>
        this.associadoService
          .listarAssociados(0, 8, { nome: termo, status: 'ATIVO' })
          .pipe(catchError(() => of(null)))
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(resposta => {
      this.buscandoDestinatario.set(false);
      if (resposta) {
        this.sugestoes.set(resposta.items);
        this.mostrarSugestoes.set(resposta.items.length > 0);
      }
    });
  }

  // =========================================================================
  // AUTOCOMPLETE — DESTINATÁRIO
  // =========================================================================

  onBuscaDestinatario(valor: string): void {
    this.termoBuscaDestinatario.set(valor);

    // Limpa seleção anterior quando o usuário começa a digitar novamente
    this.destinatarioSelecionado.set(null);
    this.form.patchValue({ idDestinatario: null });

    if (valor.length < 2) {
      this.sugestoes.set([]);
      this.mostrarSugestoes.set(false);
      return;
    }

    this._busca$.next(valor);
  }

  selecionarDestinatario(associado: AssociadoResponseDto): void {
    this.destinatarioSelecionado.set(associado);
    this.termoBuscaDestinatario.set(associado.nomeCompleto);
    this.form.patchValue({ idDestinatario: associado.idAssociado });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  limparDestinatario(): void {
    this.destinatarioSelecionado.set(null);
    this.termoBuscaDestinatario.set('');
    this.form.patchValue({ idDestinatario: null });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  /**
   * Aguarda 150ms antes de ocultar para que o click na sugestão registre
   * antes do blur fechar a lista. Sem esse delay, (mousedown) não dispara.
   */
  ocultarSugestoes(): void {
    setTimeout(() => this.mostrarSugestoes.set(false), 150);
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.form.invalid || this.carregando()) return;

    this.carregando.set(true);
    const raw = this.form.getRawValue();

    this.conexaoService
      .registrar({
        idDestinatario:    raw.idDestinatario!,
        tipo:              raw.tipo as TipoConexao,
        nomeCandidato:     raw.nomeCandidato!,
        telefoneCandidato: raw.telefoneCandidato!,
        complemento:       raw.complemento || undefined,
      })
      .subscribe({
        next: (novaConexao: ConexaoGeradaResponseDto) => {
          this.carregando.set(false);
          this.modalService.fechar(novaConexao);
        },
        error: (err: HttpErrorResponse) => {
          this.carregando.set(false);
          const mensagem =
            err.error?.message ??
            (err.status === 0
              ? 'Servidor indisponível. Verifique sua conexão.'
              : 'Erro ao registrar conexão. Tente novamente.');
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
  // HELPERS
  // =========================================================================

  /**
   * mascararCpf(cpf)
   *
   * Exibe apenas os dígitos do meio, ocultando o primeiro bloco e os
   * dois últimos dígitos. Ex: "12345678909" → "***.456.789-**"
   * Evita expor o CPF completo no dropdown de sugestões.
   */
  mascararCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return '***.***.***-**';
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }

  /**
   * Contador de caracteres restantes para o campo complemento.
   * Usado pelo template para exibir feedback visual inline.
   */
  get complementoRestante(): number {
    return 130 - (this.form.get('complemento')?.value?.length ?? 0);
  }

  /**
   * Padrão CLAUDE.md §8.3 — erro no footer com auto-dismiss de 3 segundos.
   * Nunca chama sinal.set() diretamente: centraliza o setTimeout aqui.
   */
  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }
}
