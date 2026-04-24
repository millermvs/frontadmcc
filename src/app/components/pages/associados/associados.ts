import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import {
  AssociadoEditarEquipeRequestDto,
  AssociadoRequestDto,
  AssociadoResponseDto,
  LABELS_STATUS_ASSOCIADO,
  STATUS_ASSOCIADO_OPCOES,
  StatusAssociado,
} from '../../../models/associado.model';
import { AtuacaoEspecificaResponseDto, ClusterResponseDto } from '../../../models/cluster.model';
import { CargoLiderancaResponseDto } from '../../../models/cargo-lideranca.model';
import {
  AssociadoCargoLiderancaRequestDto,
  AssociadoCargoLiderancaResponseDto,
} from '../../../models/associado-cargo.model';
import { EquipeResponseDto } from '../../../models/equipe.model';
import { AssociadoService } from '../../../services/associado.service';
import { AssociadoCargoService } from '../../../services/associado-cargo.service';
import { CargoLiderancaService } from '../../../services/cargo-lideranca.service';
import { ClusterService } from '../../../services/cluster.service';
import { EquipeService } from '../../../services/equipe.service';

// ============================================================================
// VALIDADOR CUSTOMIZADO — Data não pode ser futura
//
// Definido fora da classe para evitar problemas de contexto (this) quando
// passado como referência ao FormBuilder. Puro — sem efeitos colaterais.
// ============================================================================
function validarDataNaoFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  // Sufixo T00:00:00 garante comparação em horário local (evita off-by-one por fuso)
  const data = new Date(control.value + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data > hoje ? { dataFutura: true } : null;
}

/**
 * ASSOCIADOS PAGE COMPONENT
 *
 * Página de listagem e gerenciamento de associados.
 *
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Exibe dados vindos do Service
 * - Captura ações do usuário (filtros, cliques, submit)
 * - Delega toda lógica ao Service (sem HTTP direto)
 *
 * Blocos implementados:
 *   Bloco 2: Listagem paginada com filtros e KPI cards
 *   Bloco 3: Modal de cadastro de novo associado (este arquivo)
 *   Bloco 4+: Modal de edição e ações rápidas (próximos blocos)
 */
@Component({
  selector: 'app-associados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './associados.html',
  styleUrl: './associados.css',
})
export class Associados implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private associadoService      = inject(AssociadoService);
  private associadoCargoService = inject(AssociadoCargoService);
  private equipeService         = inject(EquipeService);
  private cargoService          = inject(CargoLiderancaService);
  private clusterService        = inject(ClusterService);
  private fb                    = inject(FormBuilder);
  private destroyRef            = inject(DestroyRef);

  // =========================================================================
  // VIEWCHILD — referências aos botões ocultos que fecham os modais
  //
  // Por que ViewChild em vez de document.getElementById?
  // CLAUDE.md §2.2 proíbe manipulação direta do DOM no componente.
  // ViewChild é a forma Angular idiomática de referenciar elementos do template.
  // =========================================================================

  @ViewChild('btnFecharModalNovoAssociado')
  private btnFecharCadastro!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEdicao')
  private btnFecharEdicao!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEquipe')
  private btnFecharEquipe!: ElementRef<HTMLButtonElement>;

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca      = signal('');
  filtroStatus    = signal<StatusAssociado | 'Todos'>('Todos');
  filtroEquipeId  = signal<number | null>(null);
  associados      = signal<AssociadoResponseDto[]>([]);
  equipes         = signal<EquipeResponseDto[]>([]);
  totalAssociados = signal(0);
  carregandoLista = signal(false);

  /**
   * buscaSubject
   *
   * Intermediário RxJS para debounce da busca por texto.
   * Cada tecla emite para o subject; o pipe debounceTime(400) só
   * dispara a chamada ao backend 400ms depois da última tecla.
   * Evita uma requisição por keystroke em campos de texto livre.
   */
  private readonly buscaSubject = new Subject<string>();

  // =========================================================================
  // SIGNALS — PAGINAÇÃO
  // =========================================================================

  /** Página zero-based enviada ao backend. */
  paginaAtual   = signal(0);
  tamanhoPagina = signal(20);

  /** Total de páginas retornado pelo backend. */
  totalPaginas  = signal(0);

  /** Flags que espelham hasNext / hasPrevious do backend. */
  temProxima  = signal(false);
  temAnterior = signal(false);

  // =========================================================================
  // SIGNALS — MODAL DE CADASTRO (Bloco 3)
  // =========================================================================

  /** Controla o spinner do botão "Cadastrar Associado" durante o POST. */
  carregandoModal      = signal(false);

  /**
   * Controla o spinner que substitui o formulário enquanto o forkJoin
   * carrega equipes, clusters e cargos de liderança.
   */
  carregandoDadosModal = signal(false);

  /** Mensagem de erro exibida no rodapé do modal (acima dos botões). */
  erroModal            = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend (400 com objeto errors).
   * Chave = nome do campo Java (ex: 'cpf'), valor = mensagem.
   * Exibidos inline abaixo de cada input no template.
   */
  errosValidacao       = signal<Record<string, string>>({});

  // =========================================================================
  // SIGNALS — MODAL DE CARGO (Bloco 4)
  //
  // Gerencia a abertura do modal de atribuição de cargos por associado.
  // O associadoParaCargo guarda a linha clicada na tabela — é a fonte de
  // verdade para o idAssociado enviado no POST.
  // =========================================================================

  /**
   * associadoParaCargo
   * Associado da linha clicada. Exposto ao template para exibir o nome
   * no título do modal. Null enquanto nenhum modal estiver aberto.
   */
  associadoParaCargo = signal<AssociadoResponseDto | null>(null);

  /**
   * cargosDoAssociado
   * Lista de AssociadoCargoLiderancaResponseDto carregada via
   * GET /api/v1/associados-cargos/associado/{id} ao abrir o modal.
   * Inclui ativos e histórico (ativo: false com dataFim preenchida).
   */
  cargosDoAssociado = signal<AssociadoCargoLiderancaResponseDto[]>([]);

  /** Controla o spinner enquanto o forkJoin inicial carrega os dados do modal. */
  carregandoCargos = signal(false);

  /** Controla o spinner do botão "Atribuir Cargo" durante o POST. */
  carregandoModalCargo = signal(false);

  /** Mensagem de erro exibida no rodapé do modal de cargo. */
  erroModalCargo = signal<string | null>(null);

  /**
   * errosValidacaoCargo
   * Erros por campo retornados pelo backend (400).
   * Mesma estratégia do modal de cadastro: normaliza chaves aninhadas.
   */
  errosValidacaoCargo = signal<Record<string, string>>({});

  /**
   * formCargo
   * Formulário do modal de cargo — apenas dois campos:
   * idCargoLideranca (select) e dataInicio (date).
   */
  formCargo: FormGroup = this.criarFormCargo();

  /**
   * cargosDisponiveis
   * Computed: catálogo de cargos ativos filtrado para remover os que o
   * associado já exerce ativamente. Comparação por nomeCargo normalizado
   * (trim + lowercase) — o ResponseDto de cargo do associado não expõe
   * idCargoLideranca, então nome é a única chave comparável.
   *
   * Recalcula automaticamente sempre que cargos() ou cargosDoAssociado()
   * mudam (ex: após um POST bem-sucedido que adiciona à lista).
   */
  cargosDisponiveis = computed(() => {
    const nomesAtivos = new Set(
      this.cargosDoAssociado()
        .filter(c => c.ativo)
        .map(c => c.nomeCargo.trim().toLowerCase())
    );
    return this.cargos().filter(
      c => !nomesAtivos.has(c.nomeCargo.trim().toLowerCase())
    );
  });

  // =========================================================================
  // SIGNALS — MODAL DE EDIÇÃO (Bloco 4)
  //
  // Separados dos signals de cadastro para que os dois fluxos não interfiram.
  // associadoParaEditar guarda o objeto completo carregado via GET — é a fonte
  // de verdade para os campos silenciosos enviados no PUT.
  // =========================================================================

  /**
   * associadoParaEditar
   * Dados frescos do associado. Preenchido no forkJoin de abrirModalEdicao().
   * Campos que o formulário não expõe (dataIngresso, statusAssociado, etc.)
   * são lidos diretamente daqui na hora do submit.
   */
  associadoParaEditar = signal<AssociadoResponseDto | null>(null);

  /** Spinner que substitui o corpo do modal enquanto os GETs do forkJoin carregam. */
  carregandoEdicao      = signal(false);

  /** Spinner do botão "Salvar Alterações" durante o PUT. */
  carregandoSalvarEdicao = signal(false);

  /** Mensagem de erro exibida no rodapé do modal de edição. */
  erroModalEdicao       = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400). */
  errosValidacaoEdicao  = signal<Record<string, string>>({});


  /**
   * idCargoSilencioso / dataInicioCargoSilencioso
   * Cargo ativo do associado, necessário para preencher idCargoLideranca e
   * dataInicioCargo no PUT (o backend valida @NotNull — não pode omitir).
   * O cargo NÃO aparece no formulário de edição; é carregado silenciosamente
   * via GET /associados-cargos/associado/{id} e enviado como dado invisível.
   *
   * Como AssociadoCargoLiderancaResponseDto não expõe idCargoLideranca,
   * o ID é encontrado por match de nomeCargo no catálogo de cargos.
   */
  idCargoSilencioso           = signal<number | null>(null);
  dataInicioCargoSilencioso   = signal<string | null>(null);

  // =========================================================================
  // SIGNALS — MODAL DE EQUIPE
  //
  // Fluxo simples (sem forkJoin): a lista de equipes já está carregada em
  // this.equipes() desde o ngOnInit. O modal apenas exibe os dados do
  // associado clicado e um select com todas as equipes ativas.
  // =========================================================================

  /**
   * associadoParaEquipe
   * Associado da linha clicada. Fonte de verdade do idAssociado no PUT.
   * Também fornece nomeEquipeOrigem e nomeEquipe para exibição readonly.
   */
  associadoParaEquipe = signal<AssociadoResponseDto | null>(null);

  /** Spinner do botão "Salvar Transferência" durante o PUT. */
  carregandoModalEquipe = signal(false);

  /** Mensagem de erro exibida no rodapé do modal. */
  erroModalEquipe = signal<string | null>(null);

  /**
   * formEquipe
   * Formulário com um único campo: idEquipe.
   * patchValue() ao abrir o modal pré-seleciona a equipe atual;
   * o botão salvar só habilita quando o usuário altera (form.dirty).
   */
  formEquipe: FormGroup = this.criarFormEquipe();

  // =========================================================================
  // SIGNALS — DADOS DE SUPORTE (dropdowns do modal)
  //
  // Carregados via forkJoin ao abrir o modal (Tarefa 3.1).
  // Reutilizados entre aberturas — só recarregam se a lista estiver vazia.
  // =========================================================================

  clusters = signal<ClusterResponseDto[]>([]);
  cargos   = signal<CargoLiderancaResponseDto[]>([]);

  /**
   * atuacoes
   * Populado dinamicamente quando o usuário seleciona um cluster.
   * Resetado ao trocar de cluster ou ao fechar o modal.
   */
  atuacoes = signal<AtuacaoEspecificaResponseDto[]>([]);

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE DE PADRINHO (Tarefa 3.3)
  //
  // O padrinho é um campo de busca livre (não um select) porque a lista de
  // associados é grande. O texto digitado é um intermediário de UI — o dado
  // real que vai para o DTO é o idPadrinhoSelecionado.
  // =========================================================================

  nomePadrinhoInput        = signal('');
  sugestoesPadrinho        = signal<AssociadoResponseDto[]>([]);
  idPadrinhoSelecionado    = signal<number | null>(null);
  mostrarSugestoesPadrinho = signal(false);
  buscandoPadrinho         = signal(false);

  /**
   * padrinhoSubject
   *
   * Canal de debounce para a busca de padrinho. Cada keystroke emite aqui;
   * o pipe switchMap cancela a requisição anterior e dispara uma nova após
   * 300ms de silêncio. Evita requisições desnecessárias e race conditions.
   */
  private readonly padrinhoSubject = new Subject<string>();

  // =========================================================================
  // FORMULÁRIO REATIVO — CADASTRO (Tarefa 3.2 / 3.3 / 3.4)
  //
  // Por que ReactiveFormsModule?
  // CLAUDE.md §8.1: formulários com 6+ campos devem usar ReactiveFormsModule
  // + FormBuilder. O modal de cadastro tem 17 campos.
  // =========================================================================

  formCadastro: FormGroup = this.criarFormCadastro();

  /**
   * formEdicao
   * Formulário reativo do modal de edição. Campos que não aparecem na UI
   * (dataIngresso, cargo, etc.) não estão aqui — são lidos de associadoParaEditar()
   * e injetados no DTO silenciosamente no salvarEdicao().
   *
   * CPF é disabled: visível como identificação mas não editável.
   * getRawValue() o inclui no valor lido para o PUT.
   */
  formEdicao: FormGroup = this.criarFormEdicao();

  // =========================================================================
  // CONSTANTES
  //
  // Expostas como propriedades readonly para o template acessar
  // sem depender de imports no HTML (Angular encapsula o escopo do template).
  // =========================================================================

  readonly LABELS_STATUS = LABELS_STATUS_ASSOCIADO;
  readonly STATUS_OPCOES = STATUS_ASSOCIADO_OPCOES;

  // =========================================================================
  // COMPUTED — CONTADORES (KPI cards)
  //
  // computed(): os valores derivam diretamente
  // do signal associados(), sem efeitos colaterais. Recalculam automaticamente
  // quando a lista muda (nova página carregada ou filtro aplicado).
  // =========================================================================

  totalAtivos    = computed(() => this.associados().filter(a => a.statusAssociado === 'ATIVO').length);
  totalPreAtivos = computed(() => this.associados().filter(a => a.statusAssociado === 'PREATIVO').length);
  totalInativos  = computed(() =>
    this.associados().filter(a => (a.statusAssociado as string).startsWith('INATIVO')).length
  );

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    // Debounce da busca por texto (listagem)
    this.buscaSubject.pipe(
      debounceTime(1000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.carregarAssociados(0));

    // Inicia os observadores dos modais
    this.observarCluster(); // cadastro
    this.observarPadrinho();

    // Carga inicial da listagem
    this.carregarAssociados();
    this.carregarEquipes();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS DA LISTAGEM
  // =========================================================================

  /**
   * atualizarBusca(valor)
   *
   * Atualiza o signal para reflexo imediato no input (UX),
   * mas delega a chamada ao backend para o buscaSubject com debounce.
   */
  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
    this.buscaSubject.next(valor);
  }

  /** Selects disparam imediatamente — sem debounce (ação discreta, não contínua). */
  atualizarFiltroStatus(valor: StatusAssociado | 'Todos'): void {
    this.filtroStatus.set(valor);
    this.carregarAssociados(0);
  }

  atualizarFiltroEquipe(idEquipe: string): void {
    this.filtroEquipeId.set(idEquipe === 'Todos' ? null : Number(idEquipe));
    this.carregarAssociados(0);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO
  // =========================================================================

  /**
   * totalPaginasArray()
   *
   * Gera array de índices [0, 1, ..., totalPaginas-1].
   * Usado pelo @for do template para renderizar os botões numéricos de página.
   */
  totalPaginasArray(): number[] {
    return Array.from({ length: this.totalPaginas() }, (_, i) => i);
  }

  /**
   * irParaPagina(pagina)
   *
   * Único ponto de entrada de navegação — valida os limites antes de agir.
   * proximaPagina e paginaAnterior delegam para cá.
   */
  irParaPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.carregarAssociados(pagina);
  }

  proximaPagina(): void  { this.irParaPagina(this.paginaAtual() + 1); }
  paginaAnterior(): void { this.irParaPagina(this.paginaAtual() - 1); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — HELPERS DE TEMPLATE
  // =========================================================================

  /**
   * formatarData(data)
   *
   * Converte yyyy-MM-dd (ISO 8601 do backend) em dd/MM/yyyy (legível pelo usuário).
   * Retorna '—' para datas nulas (campos opcionais como dataVencimento de isentos).
   */
  formatarData(data: string | null): string {
    if (!data) return '—';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * mascararCpf(cpf)
   *
   * Exibe CPF parcialmente mascarado: primeiros 3 dígitos + *** + último trecho.
   * Ex: "12345678901" → "123.***.***-01"
   * Preserva legibilidade suficiente para identificação sem expor o dado completo.
   */
  mascararCpf(cpf: string): string {
    if (!cpf || cpf.length !== 11) return cpf ?? '—';
    return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
  }

  /**
   * iniciais(nome)
   *
   * Extrai as iniciais do primeiro e último nome para o avatar.
   * Ex: "João Carlos Silva" → "JS"
   * Reutilizado no autocomplete de padrinho.
   */
  iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * classeStatus(status)
   *
   * Mapeia o enum de status para as classes CSS correspondentes do styles.css global.
   * Todos os status INATIVO_* recebem a classe status-inativa — variações de
   * subtipo são expressas apenas no label (LABELS_STATUS), não na cor.
   */
  classeStatus(status: StatusAssociado): string {
    switch (status) {
      case 'ATIVO':    return 'status-chip status-ativa';
      case 'PREATIVO': return 'status-chip status-pre-ativo';
      default:         return 'status-chip status-inativa';   // todos os INATIVO_*
    }
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE CADASTRO — Bloco 3
  // =========================================================================

  /**
   * abrirModalCadastro()
   *
   * Chamado pelo (click) do botão "Novo Associado" — antes do Bootstrap
   * abrir o modal visualmente. Reseta o estado do formulário e dispara
   * o carregamento dos dados de suporte.
   *
   * O Bootstrap abre o modal pelo data-bs-toggle no botão da listagem.
   */
  abrirModalCadastro(): void {
    this.resetarFormularioCadastro();
    this.carregarDadosModal();
  }

  /**
   * resetarFormularioCadastro()
   *
   * Reseta o formulário e todos os signals do modal ao estado inicial.
   * Chamado ao abrir o modal, pelo botão Cancelar e pelo ícone X.
   *
   * Nota: formCadastro.reset() dispara valueChanges do idCluster,
   * que automaticamente desabilita idAtuacaoEspecifica via observarCluster().
   */
  resetarFormularioCadastro(): void {
    this.formCadastro.reset({
      exibirAniversario: false,
      dataInicioCargo:   this.obterDataHoje(),
    });
    this.erroModal.set(null);
    this.errosValidacao.set({});
    this.idPadrinhoSelecionado.set(null);
    this.nomePadrinhoInput.set('');
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
    this.atuacoes.set([]);

    // Reaplica o cargo Associado após o reset — o reset() zera todos os
    // controles, incluindo os disabled. Se os cargos já estão em memória
    // (reabertura do modal), restaura imediatamente sem nova requisição.
    this.aplicarCargoAssociado();
  }

  /**
   * salvarNovoAssociado() — Tarefa 3.5
   *
   * Monta o AssociadoRequestDto a partir do formulário e do signal de padrinho,
   * remove máscaras dos campos numéricos e delega ao service.
   *
   * O status é sempre 'PREATIVO' — nunca exibido ao usuário.
   * idEquipe e idEquipeOrigem recebem o MESMO valor no cadastro (conforme PRD).
   */
  salvarNovoAssociado(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const val = this.formCadastro.getRawValue();

    const dto: AssociadoRequestDto = {
      // ── Dados pessoais ──────────────────────────────────────
      nomeCompleto:      val.nomeCompleto?.trim(),
      cpf:               (val.cpf as string).replace(/\D/g, ''),
      emailPrincipal:    val.emailPrincipal?.trim(),
      telefonePrincipal: (val.telefonePrincipal as string).replace(/\D/g, ''),
      dataNascimento:    val.dataNascimento,

      // ── Dados administrativos ───────────────────────────────
      dataIngresso:                  val.dataIngresso,
      dataPagamentoPrimeiraAnuidade: val.dataPagamentoPrimeiraAnuidade || null,

      // ── Status e origem — fixos no cadastro ─────────────────
      statusAssociado:  'PREATIVO',
      tipoOrigemEquipe: 'ORIGINAL',

      // ── Vínculos ────────────────────────────────────────────
      idEquipeAtual:            Number(val.idEquipe),
      idEquipeOrigem:      Number(val.idEquipe), // mesmo valor no cadastro (PRD)
      idCluster:           Number(val.idCluster),
      idAtuacaoEspecifica: Number(val.idAtuacaoEspecifica),
      idPadrinho:          this.idPadrinhoSelecionado(),
      idCargoLideranca:    Number(val.idCargoLideranca),
      dataInicioCargo:     val.dataInicioCargo,

      // ── Visibilidade ────────────────────────────────────────
      exibirAniversario: val.exibirAniversario ?? false,

      // ── Endereço residencial ─────────────────────────────────
      rua:         val.rua?.trim(),
      numero:      val.numero?.trim(),
      complemento: val.complemento?.trim() || null,
      bairro:      val.bairro?.trim(),
      cidade:      val.cidade?.trim(),
      estado:      (val.estado as string).toUpperCase().trim(),
      cep:         (val.cep as string).replace(/\D/g, ''),
    };

    this.associadoService.cadastrarAssociado(dto).subscribe({
      next: () => {
        this.btnFecharCadastro.nativeElement.click();
        this.carregarAssociados(0); // novo item: volta à primeira página
        // TODO: toastService.sucesso('Associado cadastrado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao cadastrar associado:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(this.normalizarErros(err.error.errors));
          this.erroModal.set('Corrija os campos destacados.');
        } else {
          this.erroModal.set(this.extrairMensagemErro(err));
        }
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE CARGO (Bloco 4)
  // =========================================================================

  /**
   * abrirModalCargo(associado)
   *
   * Chamado pelo (click) do botão de cargo na tabela, antes do Bootstrap
   * exibir o modal. Registra o associado clicado, reseta o formulário e
   * carrega em paralelo:
   *   - Cargos do associado (sempre frescos — GET por associado)
   *   - Catálogo de cargos (só se ainda não estiver em memória)
   *
   * Por que forkJoin com of(null)?
   * Se o catálogo já foi carregado (ex: modal de cadastro aberto antes),
   * of(null) completa imediatamente — o forkJoin não bloqueia para um GET
   * desnecessário. O bloco next verifica catalogo !== null antes de setar.
   */
  abrirModalCargo(associado: AssociadoResponseDto): void {
    this.associadoParaCargo.set(associado);
    this.erroModalCargo.set(null);
    this.errosValidacaoCargo.set({});
    this.formCargo.reset({ dataInicio: this.obterDataHoje() });
    this.carregandoCargos.set(true);

    forkJoin({
      cargosAssociado: this.associadoCargoService.listarPorAssociado(associado.idAssociado),
      catalogo: this.cargos().length > 0
        ? of(null)
        : this.cargoService.listar(0, 100),
    }).subscribe({
      next: ({ cargosAssociado, catalogo }) => {
        this.cargosDoAssociado.set(cargosAssociado);
        if (catalogo) {
          // Filtra apenas ativos para os selects (mesmo critério do modal de cadastro)
          this.cargos.set(catalogo.items.filter((c: CargoLiderancaResponseDto) => c.ativo));
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados do modal de cargo:', err);
        this.erroModalCargo.set('Erro ao carregar dados. Feche e tente novamente.');
        this.carregandoCargos.set(false);
      },
      complete: () => this.carregandoCargos.set(false),
    });
  }

  /**
   * salvarCargo()
   *
   * Monta o AssociadoCargoLiderancaRequestDto e faz POST.
   * Após sucesso: atualiza cargosDoAssociado() com o novo cargo retornado
   * e reseta o formulário — o modal permanece aberto para atribuições adicionais.
   * O computed cargosDisponiveis() se atualiza automaticamente, removendo
   * o cargo recém-atribuído do select.
   */
  salvarCargo(): void {
    const associado = this.associadoParaCargo();
    if (!associado) return;

    this.carregandoModalCargo.set(true);
    this.erroModalCargo.set(null);
    this.errosValidacaoCargo.set({});

    const val = this.formCargo.getRawValue();

    const dto: AssociadoCargoLiderancaRequestDto = {
      idAssociado:      associado.idAssociado,
      idCargoLideranca: Number(val.idCargoLideranca),
      dataInicio:       val.dataInicio,
      dataFim:          null,  // indeterminado — encerramento é operação separada
      ativo:            true,
    };

    this.associadoCargoService.designarCargo(dto).subscribe({
      next: (novoCargo) => {
        // Adiciona ao final da lista sem recarregar — o computed recalcula em seguida
        this.cargosDoAssociado.update(lista => [...lista, novoCargo]);
        this.formCargo.reset({ dataInicio: this.obterDataHoje() });
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao atribuir cargo:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoCargo.set(this.normalizarErros(err.error.errors));
          this.erroModalCargo.set('Corrija os campos destacados.');
        } else if (err.status === 409) {
          this.erroModalCargo.set(
            err.error?.message ?? 'Este associado já possui este cargo ativo.'
          );
        } else {
          this.erroModalCargo.set(this.extrairMensagemErro(err));
        }
        this.carregandoModalCargo.set(false);
      },
      complete: () => this.carregandoModalCargo.set(false),
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE EDIÇÃO — Bloco 4
  // =========================================================================

  /**
   * abrirModalEdicao(associado)
   *
   * Chamado pelo (click) do botão "Editar" na tabela, antes do Bootstrap
   * exibir o modal. Dispara um forkJoin com 4 GETs garantidos + 1 condicional:
   *
   *   Garantidos:
   *     - dadosAtuais     → dados frescos do associado (evita listagem desatualizada)
   *     - cargosAssociado → para localizar o cargo ativo (cargo silencioso no PUT)
   *     - enderecos       → o ResponseDto não traz endereço embutido
   *     - visibilidade    → para pré-preencher exibirAniversario com o valor real
   *
   *   Condicional (of(null) se já em cache):
   *     - cargos          → catálogo de cargos, necessário para o match silencioso
   *
   * Equipe, cluster e atuação não são editados aqui — cada um tem modal dedicado.
   * Os valores originais são lidos de dadosAtuais e enviados silenciosamente no PUT.
   *
   * Por que buscar dados frescos ao abrir e não usar o objeto da listagem?
   * A listagem pode estar desatualizada (outra aba editou o mesmo registro).
   * O GET por ID garante que o formulário parte de dados consistentes.
   */
  abrirModalEdicao(associado: AssociadoResponseDto): void {
    this.associadoParaEditar.set(associado); // valor provisório para o título do modal
    this.carregandoEdicao.set(true);
    this.erroModalEdicao.set(null);
    this.errosValidacaoEdicao.set({});

    forkJoin({
      dadosAtuais:     this.associadoService.buscarAssociadoPorId(associado.idAssociado),
      cargosAssociado: this.associadoCargoService.listarPorAssociado(associado.idAssociado),
      enderecos:       this.associadoService.listarEnderecosResidenciais(associado.idAssociado),
      visibilidade:    this.associadoService.buscarVisibilidade(associado.idAssociado),
      cargos:          this.cargos().length > 0
                         ? of(null)
                         : this.cargoService.listar(0, 100),
    }).subscribe({
      next: ({ dadosAtuais, cargosAssociado, enderecos, visibilidade, cargos }) => {
        // Atualiza cache condicional de cargos
        if (cargos) this.cargos.set(cargos.items.filter((c: CargoLiderancaResponseDto) => c.ativo));

        // Salva dados frescos como fonte de verdade
        this.associadoParaEditar.set(dadosAtuais);

        // Localiza cargo ativo e resolve o idCargoLideranca silencioso.
        // AssociadoCargoLiderancaResponseDto não expõe idCargoLideranca,
        // então fazemos match por nomeCargo no catálogo.
        const cargoAtivo = cargosAssociado.find((c: AssociadoCargoLiderancaResponseDto) => c.ativo);
        if (cargoAtivo) {
          const nomeNorm = cargoAtivo.nomeCargo.trim().toLowerCase();
          const match    = this.cargos().find(c => c.nomeCargo.trim().toLowerCase() === nomeNorm);
          this.idCargoSilencioso.set(match?.idCargoLideranca ?? null);
          this.dataInicioCargoSilencioso.set(cargoAtivo.dataInicio);
        } else {
          // Associado sem cargo ativo — situação anormal, bloqueamos o submit
          this.idCargoSilencioso.set(null);
          this.dataInicioCargoSilencioso.set(null);
        }

        const endereco = enderecos[0] ?? null;
        this.formEdicao.patchValue({
          nomeCompleto:                  dadosAtuais.nomeCompleto,
          cpf:                           dadosAtuais.cpf,
          emailPrincipal:                dadosAtuais.emailPrincipal,
          telefonePrincipal:             dadosAtuais.telefonePrincipal,
          dataNascimento:                dadosAtuais.dataNascimento,
          dataPagamentoPrimeiraAnuidade: dadosAtuais.dataPagamentoPrimeiraAnuidade,
          exibirAniversario:             visibilidade.exibirAniversario,
          // Endereço residencial
          rua:         endereco?.rua         ?? '',
          numero:      endereco?.numero      ?? '',
          complemento: endereco?.complemento ?? null,
          bairro:      endereco?.bairro      ?? '',
          cidade:      endereco?.cidade      ?? '',
          estado:      endereco?.estado      ?? '',
          cep:         endereco?.cep         ?? '',
        }, { emitEvent: false });

        this.carregandoEdicao.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados do associado para edição:', err);
        this.erroModalEdicao.set('Erro ao carregar os dados. Feche o modal e tente novamente.');
        this.carregandoEdicao.set(false);
      },
    });
  }

  /**
   * salvarEdicao()
   *
   * Monta o AssociadoRequestDto combinando:
   *   - Campos editáveis do formulário (getRawValue() inclui o CPF disabled)
   *   - Campos silenciosos do associadoParaEditar() (dataIngresso, idEquipeOrigem, etc.)
   *   - Cargo silencioso (idCargoSilencioso + dataInicioCargoSilencioso)
   *
   * Bloqueia o submit se idCargoSilencioso for null (cargo ativo não encontrado),
   * pois o backend valida @NotNull em idCargoLideranca.
   */
  salvarEdicao(): void {
    const original = this.associadoParaEditar();
    if (!original) return;

    // Guarda de cargo: se o match por nome falhou, o PUT retornaria 400 do backend.
    // Melhor bloquear aqui com mensagem clara do que receber um erro genérico.
    if (this.idCargoSilencioso() === null) {
      this.erroModalEdicao.set(
        'Cargo ativo do associado não encontrado no sistema. Entre em contato com o suporte.'
      );
      return;
    }

    this.carregandoSalvarEdicao.set(true);
    this.erroModalEdicao.set(null);
    this.errosValidacaoEdicao.set({});

    const val = this.formEdicao.getRawValue();

    const dto: AssociadoRequestDto = {
      // ── Campos editáveis pelo usuário ────────────────────────
      nomeCompleto:                  val.nomeCompleto?.trim(),
      cpf:                           (val.cpf as string).replace(/\D/g, ''),
      emailPrincipal:                val.emailPrincipal?.trim(),
      telefonePrincipal:             (val.telefonePrincipal as string).replace(/\D/g, ''),
      dataNascimento:                val.dataNascimento,
      dataPagamentoPrimeiraAnuidade: val.dataPagamentoPrimeiraAnuidade || null,
      exibirAniversario:             val.exibirAniversario ?? false,
      rua:                           val.rua?.trim(),
      numero:                        val.numero?.trim(),
      complemento:                   val.complemento?.trim() || null,
      bairro:                        val.bairro?.trim(),
      cidade:                        val.cidade?.trim(),
      estado:                        (val.estado as string).toUpperCase().trim(),
      cep:                           (val.cep as string).replace(/\D/g, ''),

      // ── Campos silenciosos (originais, não editáveis neste modal) ─
      dataIngresso:        original.dataIngresso,
      tipoOrigemEquipe:    original.tipoOrigemEquipe,
      statusAssociado:     original.statusAssociado,
      idEquipeOrigem:      original.idEquipeOrigem,
      idEquipeAtual:       original.idEquipeAtual,       // editado via modal de equipe
      idCluster:           original.idCluster,           // editado via modal de cluster (futuro)
      idAtuacaoEspecifica: original.idAtuacaoEspecifica, // editado via modal de cluster (futuro)
      idPadrinho:          original.idPadrinho,

      // ── Cargo silencioso (obrigatório no backend, invisível na UI) ─
      idCargoLideranca: this.idCargoSilencioso()!,
      dataInicioCargo:  this.dataInicioCargoSilencioso()!,
    };

    this.associadoService.editarAssociado(original.idAssociado, dto).subscribe({
      next: () => {
        this.btnFecharEdicao.nativeElement.click();
        this.carregarAssociados(this.paginaAtual()); // mantém a página atual após edição
        // TODO: toastService.sucesso('Associado atualizado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao editar associado:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoEdicao.set(this.normalizarErros(err.error.errors));
          this.erroModalEdicao.set('Corrija os campos destacados.');
        } else {
          this.erroModalEdicao.set(this.extrairMensagemErro(err));
        }
        this.carregandoSalvarEdicao.set(false);
      },
      complete: () => {
        this.carregandoSalvarEdicao.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE EQUIPE
  // =========================================================================

  /**
   * abrirModalEquipe(associado)
   *
   * Chamado pelo (click) do botão de equipe na tabela, antes do Bootstrap
   * exibir o modal. Não dispara nenhum GET — a lista de equipes já está
   * em this.equipes() (carregada no ngOnInit) e os dados do associado
   * vêm diretamente da linha clicada.
   *
   * patchValue() com emitEvent padrão (true) não é problema aqui porque
   * formEquipe não tem observers de valueChanges.
   */
  abrirModalEquipe(associado: AssociadoResponseDto): void {
    this.associadoParaEquipe.set(associado);
    this.erroModalEquipe.set(null);
    this.formEquipe.reset();

    // Pré-seleciona a equipe atual — o usuário precisa TROCAR para habilitar salvar
    this.formEquipe.patchValue({ idEquipe: associado.idEquipeAtual });
  }

  /**
   * salvarEquipe()
   *
   * Monta o AssociadoEditarEquipeRequestDto com o idEquipe selecionado
   * e faz PUT /api/v1/associados/{id}/equipe.
   *
   * Após sucesso: fecha modal + recarrega a página atual.
   * O backend retorna o AssociadoResponseDto atualizado (com o novo nomeEquipe).
   */
  salvarEquipe(): void {
    const associado = this.associadoParaEquipe();
    if (!associado) return;

    this.carregandoModalEquipe.set(true);
    this.erroModalEquipe.set(null);

    const val = this.formEquipe.getRawValue();
    const dto: AssociadoEditarEquipeRequestDto = { idEquipe: Number(val.idEquipe) };

    this.associadoService.editarEquipeAssociado(associado.idAssociado, dto).subscribe({
      next: () => {
        this.btnFecharEquipe.nativeElement.click();
        this.carregarAssociados(this.paginaAtual());
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao transferir equipe do associado:', err);
        this.erroModalEquipe.set(this.extrairMensagemErro(err));
        this.carregandoModalEquipe.set(false);
      },
      complete: () => {
        this.carregandoModalEquipe.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — AUTOCOMPLETE DE PADRINHO
  // =========================================================================

  /**
   * atualizarNomePadrinho(valor)
   *
   * Emite o valor atual para o padrinhoSubject (que tem debounce 300ms).
   * Limpa a seleção anterior ao digitar — o idPadrinhoSelecionado só é
   * preenchido quando o usuário clica em uma sugestão.
   */
  atualizarNomePadrinho(valor: string): void {
    this.nomePadrinhoInput.set(valor);
    this.idPadrinhoSelecionado.set(null); // limpa seleção ao digitar
    this.padrinhoSubject.next(valor);
  }

  /**
   * selecionarPadrinho(assoc)
   *
   * Chamado ao clicar em um item da lista de sugestões.
   * Armazena o idAssociado e fecha o dropdown.
   */
  selecionarPadrinho(assoc: AssociadoResponseDto): void {
    this.idPadrinhoSelecionado.set(assoc.idAssociado);
    this.nomePadrinhoInput.set(assoc.nomeCompleto);
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
  }

  /**
   * fecharSugestoesPadrinho()
   *
   * Chamado pelo evento (blur) do input de padrinho.
   * O delay de 200ms permite que o evento (mousedown) das sugestões
   * dispare antes do fechamento, preservando o clique nas sugestões.
   */
  fecharSugestoesPadrinho(): void {
    setTimeout(() => this.mostrarSugestoesPadrinho.set(false), 200);
  }

  /**
   * limparPadrinho()
   *
   * Remove o padrinho selecionado e limpa o campo de busca.
   * Chamado pelo botão ✕ que aparece quando há um padrinho selecionado.
   */
  limparPadrinho(): void {
    this.idPadrinhoSelecionado.set(null);
    this.nomePadrinhoInput.set('');
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — CARGA DE DADOS
  // =========================================================================

  /**
   * carregarAssociados(page)
   *
   * Chama o service com os filtros ativos no momento da chamada.
   * É o único ponto que acessa o backend para listagem — filtros,
   * paginação e recargas de modal sempre passam por aqui.
   */
  private carregarAssociados(page: number = 0): void {
    this.carregandoLista.set(true);
    this.paginaAtual.set(page);

    const status = this.filtroStatus();
    this.associadoService.listarAssociados(page, this.tamanhoPagina(), {
      nome:     this.termoBusca(),
      status:   status !== 'Todos' ? status : undefined,
      idEquipe: this.filtroEquipeId() ?? undefined,
    }).subscribe({
      next: (response) => {
        this.associados.set(response.items);
        this.totalAssociados.set(response.totalItems);
        this.totalPaginas.set(response.totalPages);
        this.temProxima.set(response.hasNext);
        this.temAnterior.set(response.hasPrevious);
      },
      error: (erro: HttpErrorResponse) => {
        console.error('Erro ao carregar associados:', erro);
        this.carregandoLista.set(false);
      },
      complete: () => {
        this.carregandoLista.set(false);
      },
    });
  }

  /**
   * carregarEquipes()
   *
   * Carrega lista de equipes para o select de filtro (listagem) e para o
   * select de equipe dentro do modal de cadastro.
   * Usa size=100 para trazer todas as equipes em uma única requisição.
   */
  private carregarEquipes(): void {
    this.equipeService.listarEquipes(0, 100).subscribe({
      next: (response) => this.equipes.set(response.items),
      error: (err) => console.error('Erro ao carregar equipes:', err),
    });
  }

  /**
   * carregarDadosModal() — Tarefa 3.1
   *
   * Carrega em paralelo os dados necessários para os dropdowns do modal
   * (clusters e cargos). Equipes já estão disponíveis via this.equipes().
   *
   * forkJoin: dispara as duas requisições simultâneas e aguarda ambas
   * completarem antes de atualizar os signals. Garante que o formulário
   * só fica acessível com os dados prontos.
   */
  private carregarDadosModal(): void {
    // Se os dados já foram carregados (reabertura do modal), não recarrega
    if (this.clusters().length > 0 && this.cargos().length > 0) return;

    this.carregandoDadosModal.set(true);

    forkJoin({
      clusters: this.clusterService.listarClusters(0, 100),
      cargos:   this.cargoService.listar(0, 100),
    }).subscribe({
      next: ({ clusters, cargos }) => {
        this.clusters.set(clusters.items);
        // Filtra apenas cargos ativos para o select
        this.cargos.set(cargos.items.filter(c => c.ativo));
        // Pré-seleciona "Associado" automaticamente no campo fixo
        this.aplicarCargoAssociado();
      },
      error: (err: HttpErrorResponse) => {
        this.erroModal.set('Erro ao carregar os dados do formulário. Feche e tente novamente.');
        console.error('Erro no forkJoin do modal:', err);
        this.carregandoDadosModal.set(false);
      },
      complete: () => {
        this.carregandoDadosModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — OBSERVADORES REATIVOS
  // =========================================================================

  /**
   * criarFormEdicao()
   *
   * Factory do FormGroup do modal de edição. Campos que NÃO aparecem aqui:
   *   - dataIngresso       → imutável; lido de associadoParaEditar() no submit
   *   - idPadrinho         → imutável; lido de associadoParaEditar() no submit
   *   - idCargoLideranca   → cargo silencioso; lido de idCargoSilencioso() no submit
   *   - tipoOrigemEquipe   → imutável; lido de associadoParaEditar() no submit
   *   - statusAssociado    → alterado via modal próprio (Bloco 5)
   *
   * CPF: disabled — visível para identificação do associado, mas não editável.
   * getRawValue() o lê mesmo com disabled:true para incluir no PUT.
   *
   * idAtuacaoEspecifica: começa disabled, igual ao cadastro.
   * observarClusterEdicao() habilita quando o usuário seleciona um cluster.
   */
  private criarFormEdicao(): FormGroup {
    return this.fb.group({
      // ── Dados pessoais ───────────────────────────────────────────────────
      nomeCompleto:      ['', Validators.required],
      cpf:               [{ value: '', disabled: true }], // identificação, não editável
      emailPrincipal:    ['', [Validators.required, Validators.email]],
      telefonePrincipal: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      dataNascimento:    ['', Validators.required],

      // ── Dados administrativos ────────────────────────────────────────────
      dataPagamentoPrimeiraAnuidade: [null], // opcional
      exibirAniversario:             [false],

      // ── Endereço residencial ─────────────────────────────────────────────
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      estado:      ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * observarCluster() — Tarefa 3.3
   *
   * Observa mudanças no select de Cluster e:
   *   1. Desabilita/habilita o select de Atuação Específica.
   *   2. Carrega as atuações correspondentes ao cluster selecionado.
   *   3. Reseta a atuação selecionada ao trocar de cluster.
   *
   * Por que disable()/enable()?
   * Ao desabilitar via FormControl, o Angular remove automaticamente
   * a validação required da atuação, evitando que o form fique inválido
   * sem cluster selecionado. getRawValue() ainda lê o valor quando necessário.
   */
  private observarCluster(): void {
    const atuacaoControl = this.formCadastro.get('idAtuacaoEspecifica')!;

    // Começa desabilitado (nenhum cluster selecionado ao iniciar)
    atuacaoControl.disable();

    this.formCadastro.get('idCluster')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((idCluster: string | null) => {
        // Reseta a atuação ao trocar de cluster
        atuacaoControl.reset(null);
        this.atuacoes.set([]);

        if (!idCluster) {
          atuacaoControl.disable();
          return;
        }

        atuacaoControl.enable();

        this.clusterService.listarAtuacoesPorCluster(Number(idCluster), 0, 100).subscribe({
          next: (response) => this.atuacoes.set(response.items),
          error: (err) => console.error('Erro ao carregar atuações do cluster:', err),
        });
      });
  }

  /**
   * observarPadrinho() — Tarefa 3.3
   *
   * Gerencia o autocomplete do campo Padrinho com debounce de 300ms e
   * cancelamento de requisições anteriores via switchMap.
   *
   * Fluxo:
   *   1. Usuário digita → atualizarNomePadrinho() → padrinhoSubject.next()
   *   2. debounceTime(300) aguarda pausa de 300ms no digitação
   *   3. switchMap cancela a requisição anterior e dispara nova busca
   *   4. Resultado popula sugestoesPadrinho e exibe o dropdown
   */
  private observarPadrinho(): void {
    this.padrinhoSubject.pipe(
      debounceTime(300),
      switchMap((termo: string) => {
        const termLimpo = termo.trim();

        // Menos de 2 caracteres: limpa as sugestões sem chamar o backend
        if (termLimpo.length < 2) {
          this.buscandoPadrinho.set(false);
          this.mostrarSugestoesPadrinho.set(false);
          this.sugestoesPadrinho.set([]);
          return of(null);
        }

        this.buscandoPadrinho.set(true);

        // of(null) é retornado em caso de erro — não quebra o pipe
        return this.associadoService
          .listarAssociados(0, 8, { nome: termLimpo })
          .pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (response === null) {
        this.buscandoPadrinho.set(false);
        return;
      }
      this.sugestoesPadrinho.set(response.items);
      this.mostrarSugestoesPadrinho.set(response.items.length > 0);
      this.buscandoPadrinho.set(false);
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — HELPERS
  // =========================================================================

  /**
   * criarFormCargo()
   *
   * Factory do FormGroup do modal de atribuição de cargo.
   * Dois campos apenas: cargo (select obrigatório) e data de início.
   * dataInicio segue a mesma regra do cadastro: não pode ser futura.
   */
  private criarFormCargo(): FormGroup {
    return this.fb.group({
      idCargoLideranca: [null, Validators.required],
      dataInicio:       [this.obterDataHoje(), [Validators.required, validarDataNaoFutura]],
    });
  }

  /**
   * criarFormEquipe()
   *
   * Factory do FormGroup do modal de equipe. Campo único: idEquipe.
   * Começa com null — preenchido via patchValue() ao abrir o modal.
   * O campo é obrigatório para que o select em branco bloqueie o salvar.
   */
  private criarFormEquipe(): FormGroup {
    return this.fb.group({
      idEquipe: [null, Validators.required],
    });
  }

  /**
   * criarFormCadastro()
   *
   * Factory do FormGroup do modal de cadastro. Chamado na inicialização
   * da propriedade (antes do ngOnInit) — os validators são aplicados desde
   * a criação do form.
   *
   * idAtuacaoEspecifica começa disabled (observarCluster o habilita ao
   * selecionar um cluster). O Validators.required é aplicado mesmo assim —
   * quando o controle é habilitado, a validação já está ativa.
   */
  private criarFormCadastro(): FormGroup {
    return this.fb.group({
      // ── Dados pessoais ───────────────────────────────────────────────────
      nomeCompleto:      ['', Validators.required],
      cpf:               ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      emailPrincipal:    ['', [Validators.required, Validators.email]],
      telefonePrincipal: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      dataNascimento:    ['', Validators.required],

      // ── Dados administrativos ────────────────────────────────────────────
      dataIngresso:                  ['', [Validators.required, validarDataNaoFutura]],
      dataPagamentoPrimeiraAnuidade: [null], // opcional

      // ── Vínculos ─────────────────────────────────────────────────────────
      idEquipe:            [null, Validators.required],
      idCluster:           [null, Validators.required],
      idAtuacaoEspecifica: [null, Validators.required], // disable/enable via observarCluster()

      // Cargo sempre fixo como "Associado" no cadastro — habilitado só na edição.
      // Começa disabled: Angular exclui da validade do form, mas getRawValue()
      // ainda lê o valor para o DTO. Valor preenchido por aplicarCargoAssociado()
      // após o forkJoin carregar os cargos.
      idCargoLideranca:    [{ value: null, disabled: true }, Validators.required],
      dataInicioCargo:     [this.obterDataHoje(), [Validators.required, validarDataNaoFutura]],
      exibirAniversario:   [false],

      // ── Endereço residencial ─────────────────────────────────────────────
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      estado:      ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * normalizarErros(errors)
   *
   * O Spring Boot serializa erros de campos aninhados com o caminho completo:
   * ex. 'endereco.cep' → mensagem.
   * Este método remove o prefixo, deixando só o nome do campo ('cep'),
   * que é o que o template usa para acesso direto em errosValidacao().
   */
  private normalizarErros(errors: Record<string, string>): Record<string, string> {
    const resultado: Record<string, string> = {};
    for (const [chave, mensagem] of Object.entries(errors)) {
      const chaveSimples = chave.includes('.') ? chave.split('.').pop()! : chave;
      resultado[chaveSimples] = mensagem;
    }
    return resultado;
  }

  /**
   * obterDataHoje()
   *
   * Retorna a data de hoje no formato ISO 8601 (YYYY-MM-DD).
   * Usado para pré-preencher campos de data com valor padrão.
   */
  private obterDataHoje(): string {
    const hoje = new Date();
    const ano  = hoje.getFullYear();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia  = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * extrairMensagemErro(err)
   *
   * Extrai mensagem legível do erro HTTP retornado pelo backend.
   * Segue CLAUDE.md SEÇÃO 12 (formato de erro do backend).
   */
  private extrairMensagemErro(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;

    if (err.error?.errors) {
      return Object.values(err.error.errors as Record<string, string>).join(' ');
    }

    if (err.status === 0) return 'Servidor indisponível. Verifique sua conexão.';

    const mensagens: Record<number, string> = {
      400: 'Erro de validação. Verifique os dados.',
      401: 'Sessão expirada. Faça login novamente.',
      403: 'Você não tem permissão para esta ação.',
      404: 'Recurso não encontrado.',
      409: 'Conflito: CPF ou e-mail já cadastrado no sistema.',
      422: 'Violação de regra de negócio.',
      500: 'Erro interno do servidor. Tente novamente.',
    };

    return mensagens[err.status] ?? 'Erro desconhecido. Tente novamente.';
  }

  /**
   * aplicarCargoAssociado()
   *
   * Localiza o cargo de nome "Associado" na lista já carregada e o define
   * como valor do controle idCargoLideranca (que fica disabled no cadastro).
   *
   * Chamado em dois momentos:
   *   1. Após o forkJoin em carregarDadosModal() — primeira abertura.
   *   2. Em resetarFormularioCadastro() — reabertura (cargos já em memória).
   *
   * Se o cargo não for encontrado (configuração incorreta no banco),
   * o campo fica nulo e o operador receberá erro 400 do backend — intencionalmente
   * não silenciamos: é uma falha de dados que precisa ser corrigida na origem.
   */
  private aplicarCargoAssociado(): void {
    const cargo = this.cargos().find(
      c => c.nomeCargo.trim().toLowerCase() === 'associado'
    );
    if (!cargo) return;
    this.formCadastro.get('idCargoLideranca')?.setValue(cargo.idCargoLideranca);
  }
}
