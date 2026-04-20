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
  AssociadoRequestDto,
  AssociadoResponseDto,
  LABELS_STATUS_ASSOCIADO,
  STATUS_ASSOCIADO_OPCOES,
  StatusAssociado,
} from '../../../models/associado.model';
import { AtuacaoEspecificaResponseDto, ClusterResponseDto } from '../../../models/cluster.model';
import { CargoLiderancaResponseDto } from '../../../models/cargo-lideranca.model';
import { EquipeResponseDto } from '../../../models/equipe.model';
import { AssociadoService } from '../../../services/associado.service';
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

  private associadoService = inject(AssociadoService);
  private equipeService    = inject(EquipeService);
  private cargoService     = inject(CargoLiderancaService);
  private clusterService   = inject(ClusterService);
  private fb               = inject(FormBuilder);
  private destroyRef       = inject(DestroyRef);

  // =========================================================================
  // VIEWCHILD — referência ao botão oculto que fecha o modal de cadastro
  //
  // Por que ViewChild em vez de document.getElementById?
  // CLAUDE.md §2.2 proíbe manipulação direta do DOM no componente.
  // ViewChild é a forma Angular idiomática de referenciar elementos do template.
  // =========================================================================

  @ViewChild('btnFecharModalNovoAssociado')
  private btnFecharCadastro!: ElementRef<HTMLButtonElement>;

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

    // Inicia os observadores do modal de cadastro
    this.observarCluster();
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
      idCargoLideranca:    [null, Validators.required],
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
}
