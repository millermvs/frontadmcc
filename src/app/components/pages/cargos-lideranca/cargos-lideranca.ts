import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CargoLiderancaService } from '../../../services/cargo-lideranca.service';
import { ToastService } from '../../../services/toast.service';
import {
  CargoLiderancaResponseDto,
  CargoLiderancaRequestDto,
  ClassificacaoFinanceira,
  CategoriaPermissao,
} from '../../../models/cargo-lideranca.model';

/**
 * CARGOS DE LIDERANÇA — PAGE COMPONENT
 *
 * Página de gerenciamento do catálogo de cargos.
 * Exclusiva para ADM_CC (o guard de rota não existe aqui,
 * pois o controle de acesso está na navbar — o item só aparece
 * para ADM_CC — e no próprio backend via @PreAuthorize).
 *
 * Funcionalidades:
 *   - Listagem paginada com filtro de texto local
 *   - Filtro por status (todos / ativos / inativos)
 *   - Cadastro via modal
 *   - Edição via modal (pré-populado com objeto da lista, sem GET extra)
 *   - Inativar / Reativar via PUT (sem endpoint DELETE)
 *   - KPI cards: total, ativos, isentos, com permissão
 *
 * Particularidade do campo categoriaPermissao:
 *   É sensível — controla o nível de acesso ao login.
 *   O form exibe um texto de aviso quando DIRETOR ou ADM_CC é selecionado.
 */
@Component({
  selector: 'app-cargos-lideranca',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cargos-lideranca.html',
  styleUrl: './cargos-lideranca.css',
})
export class CargosLideranca implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private cargoService  = inject(CargoLiderancaService);
  private toastService  = inject(ToastService);
  private fb           = inject(FormBuilder);

  // =========================================================================
  // VIEWCHILD — botões ocultos de fechar modal (padrão Bootstrap)
  // =========================================================================

  @ViewChild('btnFecharModalNovo')
  private btnFecharNovo!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEditar')
  private btnFecharEditar!: ElementRef<HTMLButtonElement>;

  // =========================================================================
  // SIGNALS — DADOS
  // =========================================================================

  cargos = signal<CargoLiderancaResponseDto[]>([]);

  // =========================================================================
  // SIGNALS — PAGINAÇÃO
  // =========================================================================

  paginaAtual   = signal(0);
  tamanhoPagina = signal(100);
  totalPaginas  = signal(0);
  temProxima    = signal(false);
  temAnterior   = signal(false);
  totalItens    = signal(0);

  // =========================================================================
  // SIGNALS — FILTROS
  // =========================================================================

  termoBusca    = signal('');
  filtroStatus  = signal<'todos' | 'ativos' | 'inativos'>('todos');

  // =========================================================================
  // SIGNALS — LOADING / MODAL
  // =========================================================================

  carregando      = signal(false);
  carregandoModal = signal(false);
  erroModal       = signal<string | null>(null);
  errosValidacao  = signal<Record<string, string>>({});

  /** ID do cargo sendo editado (null quando é cadastro novo) */
  idCargoParaEditar = signal<number | null>(null);

  /** Cargo selecionado para confirmação de inativação/reativação */
  cargoParaToggle = signal<CargoLiderancaResponseDto | null>(null);

  // =========================================================================
  // COMPUTED — KPI CARDS
  // =========================================================================

  totalAtivos = computed(() =>
    this.cargos().filter(c => c.ativo).length
  );

  totalInativos = computed(() =>
    this.cargos().filter(c => !c.ativo).length
  );

  totalIsentos = computed(() =>
    this.cargos().filter(c => c.classificacaoFinanceira === 'ISENTO').length
  );

  totalComPermissao = computed(() =>
    this.cargos().filter(c => c.categoriaPermissao !== null).length
  );

  // =========================================================================
  // COMPUTED — FILTRO LOCAL DA TABELA
  // =========================================================================

  /**
   * Aplica filtro de texto e status sobre os itens da página atual.
   * Filtro de texto: insensível a maiúsculas, busca no nomeCargo.
   * Filtro de status: alterna entre todos, apenas ativos, apenas inativos.
   */
  cargosFiltrados = computed(() => {
    const termo  = this.termoBusca().toLowerCase().trim();
    const status = this.filtroStatus();

    return this.cargos().filter(c => {
      const passaTexto  = !termo || c.nomeCargo.toLowerCase().includes(termo);
      const passaStatus = status === 'todos'
        ? true
        : status === 'ativos'
          ? c.ativo
          : !c.ativo;
      return passaTexto && passaStatus;
    });
  });

  // =========================================================================
  // FORMULÁRIOS REATIVOS
  // =========================================================================

  formNovo:   FormGroup = this.criarForm();
  formEditar: FormGroup = this.criarForm();

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregar(0);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS
  // =========================================================================

  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
  }

  atualizarFiltroStatus(valor: 'todos' | 'ativos' | 'inativos'): void {
    this.filtroStatus.set(valor);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO
  // =========================================================================

  totalPaginasArray(): number[] {
    return Array.from({ length: this.totalPaginas() }, (_, i) => i);
  }

  irParaPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.carregar(pagina);
  }

  proximaPagina(): void  { this.irParaPagina(this.paginaAtual() + 1); }
  paginaAnterior(): void { this.irParaPagina(this.paginaAtual() - 1); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAIS: RESET
  // =========================================================================

  resetarFormNovo(): void {
    this.formNovo.reset();
    // Ativo é true por padrão no cadastro
    this.formNovo.patchValue({ ativo: true, categoriaPermissao: null });
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  resetarFormEditar(): void {
    this.formEditar.reset();
    this.idCargoParaEditar.set(null);
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CARGO: CADASTRAR
  // =========================================================================

  salvarNovo(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const dto: CargoLiderancaRequestDto = {
      ...this.formNovo.getRawValue(),
      categoriaPermissao: this.formNovo.value.categoriaPermissao || null,
    };

    this.cargoService.cadastrar(dto).subscribe({
      next: () => {
        this.btnFecharNovo.nativeElement.click();
        this.resetarFormNovo();
        this.carregar(0);
        this.toastService.sucesso('Cargo cadastrado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CARGO: EDITAR
  // =========================================================================

  abrirModalEditar(cargo: CargoLiderancaResponseDto): void {
    this.idCargoParaEditar.set(cargo.idCargoLideranca);
    this.errosValidacao.set({});
    this.erroModal.set(null);

    this.formEditar.patchValue({
      nomeCargo:               cargo.nomeCargo,
      classificacaoFinanceira: cargo.classificacaoFinanceira,
      categoriaPermissao:      cargo.categoriaPermissao ?? '',
      ativo:                   cargo.ativo,
    });
    // Não chamamos markAsDirty() aqui intencionalmente.
    // O botão "Salvar Alterações" deve ficar desabilitado enquanto
    // o usuário não modificar nenhum campo — o Angular rastreia isso
    // automaticamente via formEditar.dirty.
  }

  salvarEditar(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const raw = this.formEditar.getRawValue();
    const dto: CargoLiderancaRequestDto = {
      ...raw,
      categoriaPermissao: raw.categoriaPermissao || null,
    };

    this.cargoService.editar(this.idCargoParaEditar()!, dto).subscribe({
      next: () => {
        this.btnFecharEditar.nativeElement.click();
        this.resetarFormEditar();
        this.carregar(this.paginaAtual());
        this.toastService.sucesso('Cargo atualizado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — INATIVAR / REATIVAR
  // =========================================================================

  /**
   * Seta o cargo que aguarda confirmação de toggle de status.
   * O modal de confirmação é aberto via data-bs-toggle no template.
   */
  prepararToggleStatus(cargo: CargoLiderancaResponseDto): void {
    this.cargoParaToggle.set(cargo);
  }

  /**
   * Executa a inativação ou reativação após confirmação no modal.
   */
  confirmarToggleStatus(): void {
    const cargo = this.cargoParaToggle();
    if (!cargo) return;

    this.carregandoModal.set(true);

    const acao = cargo.ativo
      ? this.cargoService.inativar(cargo)
      : this.cargoService.reativar(cargo);

    acao.subscribe({
      next: () => {
        document.getElementById('btnFecharModalConfirmacao')?.click();
        this.toastService.sucesso(
          cargo.ativo ? 'Cargo inativado com sucesso!' : 'Cargo reativado com sucesso!'
        );
        this.cargoParaToggle.set(null);
        this.carregar(this.paginaAtual());
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao alterar status:', err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — HELPERS DE EXIBIÇÃO
  // =========================================================================

  /**
   * Converte o valor do enum para label amigável na UI.
   * Ex: 'ADM_CC' → 'ADM C+C'
   */
  labelCategoria(categoria: CategoriaPermissao | null): string {
    if (!categoria) return '—';
    const mapa: Record<string, string> = {
      DIRETOR: 'Diretor',
      ADM_CC:  'ADM C+C',
    };
    return mapa[categoria] ?? categoria;
  }

  labelClassificacao(classificacao: ClassificacaoFinanceira): string {
    return classificacao === 'ISENTO' ? 'Isento' : 'Normal';
  }

  // =========================================================================
  // MÉTODOS PRIVADOS
  // =========================================================================

  private carregar(pagina: number): void {
    this.carregando.set(true);

    this.cargoService.listar(pagina, this.tamanhoPagina()).subscribe({
      next: (response) => {
        this.cargos.set(response?.items ?? []);
        this.paginaAtual.set(response?.page ?? 0);
        this.totalPaginas.set(response?.totalPages ?? 0);
        this.temProxima.set(response?.hasNext ?? false);
        this.temAnterior.set(response?.hasPrevious ?? false);
        this.totalItens.set(Number(response?.totalItems ?? 0));
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar cargos:', err);
        this.cargos.set([]);
        this.carregando.set(false);
      },
      complete: () => { this.carregando.set(false); },
    });
  }

  private tratarErroModal(err: HttpErrorResponse): void {
    if (err.status === 400 && err.error?.errors) {
      // Normaliza chaves aninhadas (ex: "localPresencial.campo" → "campo")
      const normalizados: Record<string, string> = {};
      for (const [chave, mensagem] of Object.entries(err.error.errors)) {
        const chaveSimples = chave.split('.').pop()!;
        normalizados[chaveSimples] = mensagem as string;
      }
      this.errosValidacao.set(normalizados);
      this.erroModal.set('Corrija os campos destacados.');
    } else {
      this.erroModal.set(this.extrairMensagemErro(err));
    }
  }

  private extrairMensagemErro(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;
    if (err.status === 0)   return 'Servidor indisponível. Verifique sua conexão.';

    const mensagens: Record<number, string> = {
      400: 'Erro de validação. Verifique os dados.',
      401: 'Sessão expirada. Faça login novamente.',
      403: 'Você não tem permissão para esta ação.',
      404: 'Recurso não encontrado.',
      409: 'Este registro já existe.',
      422: 'Violação de regra de negócio.',
      500: 'Erro interno do servidor. Tente novamente.',
    };

    return mensagens[err.status] ?? 'Erro desconhecido. Tente novamente.';
  }

  private criarForm(): FormGroup {
    return this.fb.group({
      nomeCargo:               ['', [Validators.required, Validators.maxLength(100)]],
      classificacaoFinanceira: ['NORMAL', Validators.required],
      categoriaPermissao:      [null],
      ativo:                   [true],
    });
  }
}
