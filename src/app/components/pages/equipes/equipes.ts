import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { formatarEnderecoCompleto } from '../../../helpers/endereco.helper';
import {
  EquipeRequestDto,
  EquipeResponseDto,
  LABELS_DIA,
  LABELS_HORARIO,
  LABELS_MODELO,
  LABELS_STATUS,
  LocalPresencialResponseDto,
  ModeloReuniao
} from '../../../models/equipe.model';
import {
  EquipeDiretorEquipeRequestDto,
  EquipeDiretorEquipeResponseDto,
  EquipeDiretorTerritorioRequestDto,
  EquipeDiretorTerritorioResponseDto,
  LABELS_NIVEL,
  NIVEIS_TERRITORIO,
  NivelDiretorTerritorio,
} from '../../../models/equipe-diretor.model';
import { AssociadoResponseDto } from '../../../models/associado.model';
import { EquipeService } from '../../../services/equipe.service';
import { EquipeDiretorService } from '../../../services/equipe-diretor.service';
import { AssociadoService } from '../../../services/associado.service';
import { ToastService } from '../../../services/toast.service';

// ============================================================================
// SHIM DE TIPO — bootstrap (global JS carregado via angular.json)
//
// O bundle bootstrap.bundle.min.js é importado no angular.json como script
// global, então `bootstrap` existe em runtime como `window.bootstrap`. Não
// instalamos @types/bootstrap (dependência extra desnecessária para um único
// uso); declaramos aqui apenas o contrato mínimo que precisamos: a API estática
// Modal.getOrCreateInstance(el).show()/hide(). Isso preserva a tipagem forte
// (CLAUDE.md §2.4) sem cair em `any`.
// ============================================================================
declare const bootstrap: {
  Modal: {
    getOrCreateInstance(el: Element): { show(): void; hide(): void };
  };
};

// ============================================================================
// VALIDADOR CUSTOMIZADO — Data não pode ser futura
//
// Mesmo validador de associados.ts (definido aqui fora da classe — helper
// puro, sem efeitos colaterais, sem dependência de this).
// ============================================================================
function validarDataNaoFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const data = new Date(control.value + 'T00:00:00');
  const hoje  = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data > hoje ? { dataFutura: true } : null;
}

// Tipo interno: estende EquipeResponseDto com campos adicionais do frontend.
// Sem export — é uma estrutura privada deste componente.
type Equipe = EquipeResponseDto & {
  membros: number;           // TODO: usar equipe.numeroComponentes quando endpoint retornar valor real
  minimoLancamento: number;  // Constante conforme PRD: mínimo para lançamento é 15
};

/**
 * EQUIPES PAGE COMPONENT
 *
 * Página de listagem e gerenciamento de equipes.
 *
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Exibe dados vindos do Service
 * - Captura ações do usuário (filtros, cliques, submit)
 * - Delega toda lógica ao Service (sem HTTP direto)
 *
 * Fluxo de cadastro:
 *   1. Usuário preenche formCadastro
 *   2. salvarNovaEquipe() extrai os valores e chama EquipeService.cadastrarEquipe()
 *   3. Service encadeia os dois endpoints internamente (transparente aqui)
 *   4. Sucesso: fecha modal via ViewChild + reseta form + recarrega lista
 *   5. Erro: exibe mensagem dentro da modal (não fecha)
 *
 * Fluxo de edição:
 *   1. abrirModalEditarEquipe() preenche formEdicao via patchValue()
 *   2. editarEquipe() extrai os valores e chama EquipeService.editarEquipe()
 *   3. Sucesso: fecha modal via ViewChild + reseta form + recarrega lista
 *   4. Erro: exibe mensagem dentro da modal (não fecha)
 */
@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './equipes.html',
  styleUrl: './equipes.css',
})
export class Equipes implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private equipesService       = inject(EquipeService);
  private equipeDiretorService = inject(EquipeDiretorService);
  private associadoService     = inject(AssociadoService);
  private toastService         = inject(ToastService);
  private fb                   = inject(FormBuilder);
  private destroyRef           = inject(DestroyRef);

  // =========================================================================
  // VIEWCHILD — referências aos botões ocultos de fechar modal
  //
  // Por que ViewChild em vez de document.getElementById?
  // CLAUDE.md §2.2 proíbe manipulação direta do DOM no componente.
  // ViewChild é a forma Angular idiomática de referenciar elementos do template.
  // =========================================================================

  @ViewChild('btnFecharModalEquipe')
  private btnFecharCadastro!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEditarEquipe')
  private btnFecharEdicao!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEndereco')
  private btnFecharEndereco!: ElementRef<HTMLButtonElement>;

  /**
   * Referência ao elemento DOM do modal de diretores.
   * Usada em abrirModalDiretores() para chamar bootstrap.Modal.getOrCreateInstance(el).show()
   * diretamente — bypass da delegação de eventos do Bootstrap, que causava
   * race condition quando signals do Angular eram atualizados antes do
   * construtor da Modal rodar (erro 'backdrop' por this._config undefined).
   */
  @ViewChild('modalDiretoresEl')
  private modalDiretoresEl!: ElementRef<HTMLElement>;

  /**
   * Referências ao elemento DOM dos modais de confirmação de encerramento
   * de cargo de Diretor de Equipe e Diretor de Território.
   * Abertos via bootstrap.Modal.getOrCreateInstance(el).show() para empilhar
   * sobre o modal de diretores sem gerar backdrop duplo.
   */
  @ViewChild('modalConfirmarEncerramentoDiretorEquipeEl')
  private modalConfirmarEncerramentoDiretorEquipeEl!: ElementRef<HTMLElement>;

  @ViewChild('modalConfirmarEncerramentoDiretorTerritorioEl')
  private modalConfirmarEncerramentoDiretorTerritorioEl!: ElementRef<HTMLElement>;

  /** Botões ocultos acionados via ViewChild para fechar os modais de confirmação. */
  @ViewChild('btnFecharModalConfirmacaoDiretorEquipe')
  private btnFecharConfirmacaoDiretorEquipe!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalConfirmacaoDiretorTerritorio')
  private btnFecharConfirmacaoDiretorTerritorio!: ElementRef<HTMLButtonElement>;

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca        = signal('');
  filtroStatus      = signal<string>('Todos');
  filtroModelo      = signal<string>('Todos');
  equipes           = signal<Equipe[]>([]);
  equipesFiltradas  = signal<Equipe[]>([]);
  totalEquipes      = signal(0);
  carregandoLista   = signal(false);

  // =========================================================================
  // SIGNALS — PAGINAÇÃO
  // =========================================================================

  /** Página zero-based enviada ao backend. */
  paginaAtual   = signal(0);
  tamanhoPagina = signal(100);

  /** Total de páginas retornado pelo backend. */
  totalPaginas  = signal(0);

  /** Flags que espelham hasNext / hasPrevious do backend. */
  temProxima    = signal(false);
  temAnterior   = signal(false);

  // =========================================================================
  // SIGNALS — MODAL
  // =========================================================================

  carregandoModal = signal(false);
  erroModalEquipe = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend (400 com objeto errors).
   * Chave = nome do campo Java (ex: 'nomeEquipe'), valor = mensagem.
   * Exibidos inline embaixo de cada input no template.
   */
  errosValidacao = signal<Record<string, string>>({});

  /**
   * ID da equipe sendo editada.
   * Signal para garantir rastreabilidade reativa — CLAUDE.md §7.2 proíbe
   * variáveis "soltas" que mudam sem rastreamento.
   */
  idEquipeParaAtualizar = signal<number | null>(null);

  // =========================================================================
  // SIGNALS — MODAL DE ENDEREÇO PRESENCIAL
  // =========================================================================

  /** Nome da equipe cujo endereço está sendo exibido/editado (para o header do modal). */
  nomeEquipeEndereco    = signal<string>('');

  /** Dados atuais do endereço retornados pelo backend — null enquanto não carregado. */
  enderecoAtual         = signal<LocalPresencialResponseDto | null>(null);

  /** ID do registro de local presencial (necessário para o PUT de edição). */
  idLocalPresencial     = signal<number | null>(null);

  /** Controla o spinner de carregamento dentro do modal de endereço. */
  carregandoEndereco    = signal(false);

  /** Mensagem de erro exibida dentro do modal de endereço. */
  erroEndereco          = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend ao salvar o endereço (400 com objeto errors).
   * Funciona igual ao errosValidacao do cadastro — chaves normalizadas via normalizarErros().
   */
  errosValidacaoEndereco = signal<Record<string, string>>({});

  /**
   * Flag de confirmação visual do botão "Copiar".
   * true = ícone troca para ✓ por 2 segundos, depois volta ao normal.
   */
  enderecoCopiado       = signal(false);

  // =========================================================================
  // SIGNALS — MODAL DE DIRETORES
  //
  // Gerencia o modal de designação de Diretor de Equipe (DE) e Diretor de
  // Território (DT). A equipe clicada na tabela é a fonte de verdade para
  // o idEquipe enviado nos POSTs.
  // =========================================================================

  /**
   * equipeSelecionadaDiretores
   * Equipe da linha clicada — exposta ao template para exibir o nome no header.
   */
  equipeSelecionadaDiretores = signal<Equipe | null>(null);

  /** Histórico completo de DEs da equipe (ativos e encerrados). */
  diretoresEquipe     = signal<EquipeDiretorEquipeResponseDto[]>([]);

  /** Histórico completo de DTs da equipe (ativos e encerrados). */
  diretoresTerritorio = signal<EquipeDiretorTerritorioResponseDto[]>([]);

  /** Spinner enquanto o forkJoin inicial carrega DE + DT. */
  carregandoDiretores     = signal(false);

  /** Spinner do botão "Designar" durante o POST. */
  carregandoModalDiretor  = signal(false);

  /** Mensagem de erro geral no rodapé do modal. */
  erroModalDiretor        = signal<string | null>(null);

  /** Erros por campo (400) normalizados pelo backend. */
  errosValidacaoDiretor   = signal<Record<string, string>>({});

  /**
   * diretorEquipeParaEncerrar / diretorTerritorioParaEncerrar
   * Registro selecionado para encerramento. Preenchido em preparar...()
   * ao clicar no botão encerrar — fonte de verdade para o PUT em encerrar...().
   * Null enquanto nenhuma confirmação estiver pendente.
   */
  diretorEquipeParaEncerrar     = signal<EquipeDiretorEquipeResponseDto | null>(null);
  diretorTerritorioParaEncerrar = signal<EquipeDiretorTerritorioResponseDto | null>(null);

  /**
   * encerrandoDiretorEquipeId / encerrandoDiretorTerritorioId
   * Armazena o ID do registro cujo PUT de encerramento está em andamento.
   * Usado para exibir spinner e desabilitar o botão "Confirmar" no modal
   * de confirmação enquanto a requisição não termina.
   */
  encerrandoDiretorEquipeId     = signal<number | null>(null);
  encerrandoDiretorTerritorioId = signal<number | null>(null);

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE DE ASSOCIADO (modal de diretores)
  //
  // Mesmo padrão do padrinho em associados.ts:
  // Subject + debounceTime + switchMap para evitar requisições desnecessárias.
  // O idAssociadoSelecionado é o dado real enviado no DTO — o texto do input
  // é apenas um intermediário de UI.
  // =========================================================================

  nomeAssociadoDiretorInput     = signal('');
  sugestoesAssociadoDiretor     = signal<AssociadoResponseDto[]>([]);
  idAssociadoDiretorSelecionado = signal<number | null>(null);
  mostrarSugestoesDiretor       = signal(false);
  buscandoAssociadoDiretor      = signal(false);

  private readonly diretorSubject = new Subject<string>();

  // =========================================================================
  // FORMULÁRIO REATIVO — DESIGNAÇÃO DE DIRETOR
  // =========================================================================

  formDiretor: FormGroup = this.criarFormDiretor();

  // =========================================================================
  // CONSTANTES — DIRETORES
  // =========================================================================

  readonly LABELS_NIVEL     = LABELS_NIVEL;
  readonly NIVEIS_TERRITORIO = NIVEIS_TERRITORIO;

  // =========================================================================
  // COMPUTED — DIRETORIA ATIVA E NÍVEIS DISPONÍVEIS
  // =========================================================================

  /**
   * diretorEquipeAtivo
   * DE ativo da equipe selecionada (ativo === true) ou false se não houver.
   */
  diretorEquipeAtivo = computed(() =>
    this.diretoresEquipe().find(d => d.ativo === true) 
  );

  /**
   * diretoresTeritorioAtivos
   * DTs ativos agrupados — pode haver DT1, DT2 e DT3 simultaneamente.
   */
  diretoresTeritorioAtivos = computed(() =>
    this.diretoresTerritorio().filter(d => d.ativo === true)
  );

  /**
   * mapaDiretoresTerritorioAtivos
   * Indexa os DTs ativos por nível para lookup O(1) no template.
   *
   * Por que um Map em vez de .find() no template?
   * CLAUDE.md §2.6 (Reatividade Declarativa) e §7.2: estado derivado deve usar
   * computed(). Chamar .find() no template re-executa a busca a cada ciclo de
   * change detection — com Map.get(nivel), a busca é constante e o cálculo só
   * roda quando diretoresTeritorioAtivos() muda.
   *
   * Bônus: evita o conflito do parser do Angular com arrow function dentro de
   * @let (NG5002 — "Bindings cannot contain assignments").
   */
  mapaDiretoresTerritorioAtivos = computed(() => {
    const mapa = new Map<NivelDiretorTerritorio, EquipeDiretorTerritorioResponseDto>();
    for (const dt of this.diretoresTeritorioAtivos()) {
      mapa.set(dt.nivel, dt);
    }
    return mapa;
  });

  /**
   * niveisDisponiveis
   * Níveis de DT que ainda não têm um vínculo ativo nesta equipe.
   * Filtra NIVEL_1/2/3 removendo os que já têm ativo (ativo === true).
   * Recalcula automaticamente após cada POST bem-sucedido.
   */
  niveisDisponiveis = computed(() => {
    const ativosSet = new Set(
      this.diretoresTeritorioAtivos().map(d => d.nivel)
    );
    return NIVEIS_TERRITORIO.filter(n => !ativosSet.has(n));
  });

  /**
   * todosCargosPreenchidos
   * true quando D.E. + todos os níveis de D.T. já têm titular ativo.
   * Usado para desabilitar o botão "Designar" e exibir alerta informativo.
   */
  todosCargosPreenchidos = computed(() =>
    !!this.diretorEquipeAtivo() && this.niveisDisponiveis().length === 0
  );

  // =========================================================================
  // FORMULÁRIOS REATIVOS
  //
  // Por que ReactiveFormsModule?
  // CLAUDE.md §8.1: formulários com 6+ campos devem usar ReactiveFormsModule
  // + FormBuilder. O modal de equipe tem 10+ campos.
  // =========================================================================

  formCadastro: FormGroup  = this.criarFormCadastro();
  formEdicao: FormGroup    = this.criarFormEdicao();
  formEndereco: FormGroup  = this.criarFormEndereco();

  // =========================================================================
  // CONSTANTES
  // =========================================================================

  readonly MINIMO_LANCAMENTO = 15;

  // Labels para exibição na tabela (backend → usuário)
  readonly LABELS_DIA     = LABELS_DIA;
  readonly LABELS_MODELO  = LABELS_MODELO;
  readonly LABELS_HORARIO = LABELS_HORARIO;
  readonly LABELS_STATUS  = LABELS_STATUS;

  // =========================================================================
  // COMPUTED — CONTADORES (KPI cards)
  // =========================================================================

  totalAtivas     = computed(() => this.equipes().filter(e => e.statusEquipe === 'ATIVA').length);
  totalEmFormacao = computed(() => this.equipes().filter(e => e.statusEquipe === 'EM_FORMACAO').length);
  totalInativas   = computed(() => this.equipes().filter(e => e.statusEquipe === 'INATIVA').length);



  // =========================================================================
  // GETTERS — valor atual do modelo de reunião em cada formulário
  //
  // Usados no template para mostrar/ocultar as seções condicionais
  // (Local Presencial e Link Online) sem precisar de [(ngModel)].
  // =========================================================================

  get modeloCadastro(): ModeloReuniao | null {
    return this.formCadastro.get('modeloReuniao')?.value ?? null;
  }

  get modeloEdicao(): ModeloReuniao | null {
    return this.formEdicao.get('modeloReuniao')?.value ?? null;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregarEquipes();
    this.observarModeloCadastro();
    this.observarModeloEdicao();
    this.observarTipoCargo();
    this.observarBuscaDiretor();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS
  // =========================================================================

  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
    this.aplicarFiltros();
  }

  atualizarFiltroStatus(valor: string): void {
    this.filtroStatus.set(valor);
    this.aplicarFiltros();
  }

  atualizarFiltroModelo(valor: string): void {
    this.filtroModelo.set(valor);
    this.aplicarFiltros();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO
  // =========================================================================

  /**
   * totalPaginasArray()
   *
   * Gera um array de índices [0, 1, 2, ... totalPaginas-1].
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
    this.carregarEquipes(pagina);
  }

  proximaPagina(): void  { this.irParaPagina(this.paginaAtual() + 1); }
  paginaAnterior(): void { this.irParaPagina(this.paginaAtual() - 1); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — RESET DOS MODAIS
  // =========================================================================

  /**
   * Reseta o formulário de CADASTRO ao estado inicial.
   * Chamado pelo botão Cancelar e pelo ícone X do modal de criação.
   */
  resetarFormulario(): void {
    this.formCadastro.reset({ nomeEquipe: 'C+C ', dataInicioFormacao: this.obterDataHoje() });
    this.errosValidacao.set({});
    this.erroModalEquipe.set(null);
  }

  /**
   * Reseta o formulário de EDIÇÃO ao estado inicial.
   * Chamado pelo botão Cancelar e pelo ícone X do modal de edição.
   */
  resetarFormularioEdicao(): void {
    this.formEdicao.reset();
    this.idEquipeParaAtualizar.set(null);
    this.errosValidacao.set({});
    this.erroModalEquipe.set(null);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE CADASTRO
  // =========================================================================

  /**
   * salvarNovaEquipe()
   *
   * Extrai os valores do formCadastro e monta o DTO unificado para o backend.
   * O campo localPresencial é enviado quando modelo ≠ ONLINE.
   * O backend persiste equipe + endereço atomicamente via @Transactional.
   */
  salvarNovaEquipe(): void {
    this.carregandoModal.set(true);
    this.erroModalEquipe.set(null);
    this.errosValidacao.set({});

    const val = this.formCadastro.getRawValue();

    const equipeDto: EquipeRequestDto = {
      nomeEquipe:            val.nomeEquipe,
      dataInicioFormacao:    val.dataInicioFormacao,
      dataEfetivaLancamento: val.dataEfetivaLancamento,
      diaReuniao:            val.diaReuniao,
      horarioReuniao:        val.horarioReuniao,
      modeloReuniao:         val.modeloReuniao,
      linkReuniaoOnline:     val.linkReuniaoOnline,
      localPresencial:       val.modeloReuniao !== 'ONLINE' ? val.localPresencial : null,
    };

    this.equipesService.cadastrarEquipe(equipeDto).subscribe({
      next: () => {
        this.btnFecharCadastro.nativeElement.click();
        this.formCadastro.reset({ nomeEquipe: 'C+C ', dataInicioFormacao: this.obterDataHoje() });
        this.errosValidacao.set({});
        this.carregarEquipes(0); // novo item: volta à primeira página
        this.toastService.sucesso('Equipe cadastrada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(this.normalizarErros(err.error.errors));
          this.erroModalEquipe.set('Corrija os campos destacados.');
        } else {
          this.erroModalEquipe.set(this.extrairMensagemErro(err));
        }
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — TABELA E MODAL DE EDIÇÃO
  // =========================================================================

  percentualFormacao(equipe: Equipe): number {
    return Math.min((equipe.membros / equipe.minimoLancamento) * 100, 100);
  }

  formatarData(data: string | null): string {
    if (!data) return '—';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  classeStatus(status: string): string {
    if (status === 'ATIVA')       return 'status-chip status-ativa';
    if (status === 'EM_FORMACAO') return 'status-chip status-formacao';
    return 'status-chip status-inativa';
  }

  iconeModelo(modelo: string): string {
    if (modelo === 'ONLINE')  return 'bi-camera-video-fill';
    if (modelo === 'HIBRIDO') return 'bi-laptop-fill';
    return 'bi-geo-alt-fill'; // PRESENCIAL
  }

  /**
   * abrirModalEditarEquipe()
   *
   * Preenche o formEdicao com os dados da equipe selecionada via patchValue().
   * O Bootstrap abre o modal pelo data-bs-toggle no botão da tabela.
   */
  abrirModalEditarEquipe(equipe: Equipe): void {
    this.idEquipeParaAtualizar.set(equipe.idEquipe);
    this.errosValidacao.set({});
    this.erroModalEquipe.set(null);

    this.formEdicao.patchValue({
      nomeEquipe:            equipe.nomeEquipe,
      dataInicioFormacao:    equipe.dataInicioFormacao,
      dataEfetivaLancamento: equipe.dataEfetivaLancamento,
      diaReuniao:            equipe.diaReuniao,
      horarioReuniao:        equipe.horarioReuniao,
      modeloReuniao:         equipe.modeloReuniao,
      linkReuniaoOnline:     equipe.linkReuniaoOnline,
      // Pré-preenche endereço se a equipe já tem um (PRESENCIAL/HÍBRIDO).
      // Se vier null (ONLINE ou lista sem o campo), o sub-grupo fica vazio
      // para o usuário preencher ao trocar o modelo.
      localPresencial: equipe.localPresencial ? {
        rua:         equipe.localPresencial.rua,
        numero:      equipe.localPresencial.numero,
        complemento: equipe.localPresencial.complemento,
        bairro:      equipe.localPresencial.bairro,
        cidade:      equipe.localPresencial.cidade,
        uf:          equipe.localPresencial.uf,
        cep:         equipe.localPresencial.cep,
      } : null,
    });
  }

  /**
   * editarEquipe()
   *
   * Extrai os valores do formEdicao, monta o DTO tipado e delega ao service.
   */
  editarEquipe(): void {
    this.carregandoModal.set(true);
    this.erroModalEquipe.set(null);
    this.errosValidacao.set({});

    const val = this.formEdicao.getRawValue();

    const equipeDto: EquipeRequestDto = {
      nomeEquipe:            val.nomeEquipe,
      dataInicioFormacao:    val.dataInicioFormacao,
      dataEfetivaLancamento: val.dataEfetivaLancamento,
      diaReuniao:            val.diaReuniao,
      horarioReuniao:        val.horarioReuniao,
      modeloReuniao:         val.modeloReuniao,
      linkReuniaoOnline:     val.linkReuniaoOnline,
      localPresencial:       val.modeloReuniao !== 'ONLINE' ? val.localPresencial : null,
    };

    this.equipesService.editarEquipe(this.idEquipeParaAtualizar()!, equipeDto).subscribe({
      next: () => {
        this.btnFecharEdicao.nativeElement.click();
        this.formEdicao.reset();
        this.idEquipeParaAtualizar.set(null);
        this.errosValidacao.set({});
        this.carregarEquipes(this.paginaAtual()); // edição: permanece na página atual
        this.toastService.sucesso('Equipe atualizada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(this.normalizarErros(err.error.errors));
          this.erroModalEquipe.set('Corrija os campos destacados.');
        } else {
          this.erroModalEquipe.set(this.extrairMensagemErro(err));
        }
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // TODO: implementar após definir UX de confirmação (modal de confirmação ou inline)
  inativarEquipe(_equipe: Equipe): void {
    // TODO: chamar EquipeService.inativarEquipe() após confirmar com o usuário
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE DIRETORES
  // =========================================================================

  /**
   * abrirModalDiretores(equipe)
   *
   * Chamado pelo (click) do botão .btn-cargo na tabela.
   * Registra a equipe clicada, reseta o estado do formulário e carrega
   * em paralelo o histórico completo de DE e DT via forkJoin.
   */
  abrirModalDiretores(equipe: Equipe): void {
    this.equipeSelecionadaDiretores.set(equipe);
    this.erroModalDiretor.set(null);
    this.errosValidacaoDiretor.set({});
    this.formDiretor.reset({ tipoCargo: 'DE', dataInicio: this.obterDataHoje() });
    this.nomeAssociadoDiretorInput.set('');
    this.idAssociadoDiretorSelecionado.set(null);
    this.sugestoesAssociadoDiretor.set([]);
    this.mostrarSugestoesDiretor.set(false);
    this.carregandoDiretores.set(true);

    // Abre o modal via API JS do Bootstrap. getOrCreateInstance reaproveita a
    // instância se já existir; caso contrário, cria uma nova e a vincula ao
    // elemento. show() é síncrono — ao retornar, o modal já está visível com
    // o spinner; o forkJoin abaixo continua em background e popula os signals
    // quando concluir.
    bootstrap.Modal.getOrCreateInstance(this.modalDiretoresEl.nativeElement).show();

    forkJoin({
      diretoresEquipe:     this.equipeDiretorService.listarDiretoresEquipe(equipe.idEquipe),
      diretoresTerritorio: this.equipeDiretorService.listarDiretoresTerritorio(equipe.idEquipe),
    }).subscribe({
      next: ({ diretoresEquipe, diretoresTerritorio }) => {
        this.diretoresEquipe.set(diretoresEquipe);
        this.diretoresTerritorio.set(diretoresTerritorio);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar diretores:', err);
        this.erroModalDiretor.set('Erro ao carregar dados. Feche e tente novamente.');
        this.carregandoDiretores.set(false);
      },
      complete: () => this.carregandoDiretores.set(false),
    });
  }

  /**
   * salvarDiretor()
   *
   * Monta o DTO e chama o endpoint correto conforme o tipoCargo selecionado.
   * Após sucesso: adiciona o novo registro ao signal correspondente (sem fechar
   * o modal) e reseta o formulário para uma possível designação em sequência.
   * Os computeds diretorEquipeAtivo e niveisDisponiveis recalculam automaticamente.
   */
  salvarDiretor(): void {
    const equipe     = this.equipeSelecionadaDiretores();
    const idAssociado = this.idAssociadoDiretorSelecionado();

    if (!equipe || !idAssociado) return;

    this.carregandoModalDiretor.set(true);
    this.erroModalDiretor.set(null);
    this.errosValidacaoDiretor.set({});

    const val = this.formDiretor.getRawValue();

    if (val.tipoCargo === 'DE') {
      const dto: EquipeDiretorEquipeRequestDto = {
        idEquipe:    equipe.idEquipe,
        idAssociado,
        dataInicio:  val.dataInicio,
        dataFim:     null,
      };
      this.equipeDiretorService.cadastrarDiretorEquipe(dto).subscribe({
        next: (novo) => {
          this.diretoresEquipe.update(lista => [...lista, novo]);
          this.resetarFormDiretor();
          this.carregarEquipes(0); // para atualizar "FROMAÇÃO" na tabela
        },
        error: (err: HttpErrorResponse) => this.tratarErroDiretor(err),
        complete: () => this.carregandoModalDiretor.set(false),
      });

    } else {
      const dto: EquipeDiretorTerritorioRequestDto = {
        idEquipe:    equipe.idEquipe,
        idAssociado,
        nivel:       val.nivel as NivelDiretorTerritorio,
        dataInicio:  val.dataInicio,
        dataFim:     null,
      };
      this.equipeDiretorService.cadastrarDiretorTerritorio(dto).subscribe({
        next: (novo) => {
          this.diretoresTerritorio.update(lista => [...lista, novo]);
          this.resetarFormDiretor();
          this.carregarEquipes(0); // para atualizar "FROMAÇÃO" na tabela         
        },
        error: (err: HttpErrorResponse) => this.tratarErroDiretor(err),
        complete: () => this.carregandoModalDiretor.set(false),
      });
    }
  }

  /**
   * prepararEncerramentoDiretorEquipe(diretor)
   *
   * Chamado pelo (click) do botão encerrar na tabela de DE.
   * Registra o diretor selecionado e abre o modal de confirmação via API
   * do Bootstrap (getOrCreateInstance + show) — evita race condition de
   * backdrop duplo ao empilhar sobre o modal de diretores já aberto.
   */
  prepararEncerramentoDiretorEquipe(diretor: EquipeDiretorEquipeResponseDto): void {
    this.diretorEquipeParaEncerrar.set(diretor);
    this.encerrandoDiretorEquipeId.set(null);
    bootstrap.Modal.getOrCreateInstance(
      this.modalConfirmarEncerramentoDiretorEquipeEl.nativeElement
    ).show();
  }

  /**
   * prepararEncerramentoDiretorTerritorio(diretor)
   *
   * Mesmo padrão do prepararEncerramentoDiretorEquipe, mas para DT.
   */
  prepararEncerramentoDiretorTerritorio(diretor: EquipeDiretorTerritorioResponseDto): void {
    this.diretorTerritorioParaEncerrar.set(diretor);
    this.encerrandoDiretorTerritorioId.set(null);
    bootstrap.Modal.getOrCreateInstance(
      this.modalConfirmarEncerramentoDiretorTerritorioEl.nativeElement
    ).show();
  }

  /**
   * encerrarCargoDiretorEquipe()
   *
   * Chamado pelo botão "Confirmar" no modal de confirmação de encerramento de DE.
   * Lê o diretor de diretorEquipeParaEncerrar() e envia PUT com dataFim = hoje.
   * Mantém todos os campos originais (idEquipe, idAssociado, dataInicio)
   * — o backend exige o objeto completo mesmo para encerramento parcial.
   * Após sucesso: fecha o modal de confirmação via botão oculto (ViewChild) —
   * o modal de diretores permanece aberto e o registro é atualizado no signal.
   */
  encerrarCargoDiretorEquipe(): void {
    const diretor = this.diretorEquipeParaEncerrar();
    if (!diretor) return;

    this.encerrandoDiretorEquipeId.set(diretor.idDiretorEquipe);
    this.erroModalDiretor.set(null);

    const dto: EquipeDiretorEquipeRequestDto = {
      idEquipe:    diretor.idEquipe,
      idAssociado: diretor.idAssociado,
      dataInicio:  diretor.dataInicio,
      dataFim:     this.obterDataHoje(),
    };

    this.equipeDiretorService.editarDiretorEquipe(diretor.idDiretorEquipe, dto).subscribe({
      next: (atualizado) => {
        this.btnFecharConfirmacaoDiretorEquipe.nativeElement.click();
        this.diretoresEquipe.update(lista =>
          lista.map(d => d.idDiretorEquipe === atualizado.idDiretorEquipe ? atualizado : d)
        );
        this.diretorEquipeParaEncerrar.set(null);
        this.carregarEquipes(0);
      },
      error: (err: HttpErrorResponse) => {
        this.btnFecharConfirmacaoDiretorEquipe.nativeElement.click();
        this.erroModalDiretor.set(this.extrairMensagemErro(err));
        this.encerrandoDiretorEquipeId.set(null);
      },
      complete: () => this.encerrandoDiretorEquipeId.set(null),
    });
  }

  /**
   * encerrarCargoDiretorTerritorio()
   *
   * Mesmo padrão do encerrarCargoDiretorEquipe(), mas para Diretor de Território.
   * O campo nivel é obrigatório no RequestDto — preservado do registro original.
   */
  encerrarCargoDiretorTerritorio(): void {
    const diretor = this.diretorTerritorioParaEncerrar();
    if (!diretor) return;

    this.encerrandoDiretorTerritorioId.set(diretor.idDiretorTerritorio);
    this.erroModalDiretor.set(null);

    const dto: EquipeDiretorTerritorioRequestDto = {
      idEquipe:    diretor.idEquipe,
      idAssociado: diretor.idAssociado,
      nivel:       diretor.nivel,
      dataInicio:  diretor.dataInicio,
      dataFim:     this.obterDataHoje(),
    };

    this.equipeDiretorService.editarDiretorTerritorio(diretor.idDiretorTerritorio, dto).subscribe({
      next: (atualizado) => {
        this.btnFecharConfirmacaoDiretorTerritorio.nativeElement.click();
        this.diretoresTerritorio.update(lista =>
          lista.map(d => d.idDiretorTerritorio === atualizado.idDiretorTerritorio ? atualizado : d)
        );
        this.diretorTerritorioParaEncerrar.set(null);
        this.carregarEquipes(0);
      },
      error: (err: HttpErrorResponse) => {
        this.btnFecharConfirmacaoDiretorTerritorio.nativeElement.click();
        this.erroModalDiretor.set(this.extrairMensagemErro(err));
        this.encerrandoDiretorTerritorioId.set(null);
      },
      complete: () => this.encerrandoDiretorTerritorioId.set(null),
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — AUTOCOMPLETE DE ASSOCIADO (diretores)
  // =========================================================================

  atualizarNomeAssociadoDiretor(valor: string): void {
    this.nomeAssociadoDiretorInput.set(valor);
    this.idAssociadoDiretorSelecionado.set(null);
    this.diretorSubject.next(valor);
  }

  selecionarAssociadoDiretor(assoc: AssociadoResponseDto): void {
    this.idAssociadoDiretorSelecionado.set(assoc.idAssociado);
    this.nomeAssociadoDiretorInput.set(assoc.nomeCompleto);
    this.sugestoesAssociadoDiretor.set([]);
    this.mostrarSugestoesDiretor.set(false);
  }

  fecharSugestoesDiretor(): void {
    setTimeout(() => this.mostrarSugestoesDiretor.set(false), 200);
  }

  limparAssociadoDiretor(): void {
    this.idAssociadoDiretorSelecionado.set(null);
    this.nomeAssociadoDiretorInput.set('');
    this.sugestoesAssociadoDiretor.set([]);
    this.mostrarSugestoesDiretor.set(false);
  }

  iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE ENDEREÇO PRESENCIAL
  // =========================================================================

  /**
   * abrirModalEndereco(equipe)
   *
   * Prepara e carrega o endereço presencial de uma equipe.
   * O Bootstrap abre o modal pelo data-bs-toggle no elemento clicável da tabela.
   * Esta função cuida apenas do estado interno e da chamada HTTP (lazy load).
   *
   * Só deve ser chamado para modelos PRESENCIAL ou HIBRIDO.
   */
  abrirModalEndereco(equipe: Equipe): void {
    this.nomeEquipeEndereco.set(equipe.nomeEquipe);
    this.enderecoAtual.set(null);
    this.idLocalPresencial.set(null);
    this.erroEndereco.set(null);
    this.errosValidacaoEndereco.set({});
    this.enderecoCopiado.set(false);
    this.carregandoEndereco.set(true);
    this.formEndereco.reset();

    this.equipesService.buscarLocalPresencial(equipe.idEquipe).subscribe({
      next: (local) => {
        this.enderecoAtual.set(local);
        this.idLocalPresencial.set(local.idLocalPresencial);
        this.formEndereco.patchValue({
          id: local.idEquipe,
          rua:         local.rua,
          numero:      local.numero,
          complemento: local.complemento,
          bairro:      local.bairro,
          cidade:      local.cidade,
          uf:          local.uf,
          cep:         local.cep,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.erroEndereco.set(this.extrairMensagemErro(err));
        this.carregandoEndereco.set(false);
      },
      complete: () => {
        this.carregandoEndereco.set(false);
      },
    });
  }

  /**
   * salvarEndereco()
   *
   * Envia o PUT com os campos editados do endereço presencial.
   */
  salvarEndereco(): void {

    if (!this.idLocalPresencial()) return;

    this.carregandoEndereco.set(true);
    this.erroEndereco.set(null);
    this.errosValidacaoEndereco.set({});

    // Monta o DTO completo incluindo idEquipe (disponível em enderecoAtual).
    // O service não tem como inferir o idEquipe sozinho neste fluxo de edição —
    // diferente do cadastro, onde o service recebe o idEquipe via switchMap do POST anterior.
    const val = this.formEndereco.getRawValue();
    const dto = { ...val, idEquipe: this.enderecoAtual()!.idEquipe };

    this.equipesService.editarLocalPresencial(this.idLocalPresencial()!, dto).subscribe({
      next: (localAtualizado) => {
        this.enderecoAtual.set(localAtualizado);
        this.btnFecharEndereco.nativeElement.click();
        this.formEndereco.reset();
        this.toastService.sucesso('Endereço presencial atualizado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoEndereco.set(this.normalizarErros(err.error.errors));
          this.erroEndereco.set('Corrija os campos destacados.');
        } else {
          this.erroEndereco.set(this.extrairMensagemErro(err));
        }
        this.carregandoEndereco.set(false);
      },
      complete: () => {
        this.carregandoEndereco.set(false);
      },
    });
  }

  /**
   * copiarEndereco()
   *
   * Copia o endereço completo formatado para a área de transferência.
   * O helper formatarEnderecoCompleto() cuida da formatação — lógica pura sem efeito colateral.
   * O feedback visual (ícone ✓ por 2s) é controlado pelo signal enderecoCopiado.
   */
  copiarEndereco(): void {
    const endereco = this.enderecoAtual();
    if (!endereco) return;

    const textoFormatado = formatarEnderecoCompleto(endereco);

    navigator.clipboard.writeText(textoFormatado).then(() => {
      this.enderecoCopiado.set(true);
      setTimeout(() => this.enderecoCopiado.set(false), 2000);
    });
  }

  /**
   * resetarFormularioEndereco()
   *
   * Limpa o estado do modal de endereço.
   * Chamado pelo botão Cancelar e pelo ícone X.
   */
  resetarFormularioEndereco(): void {
    this.formEndereco.reset();
    this.enderecoAtual.set(null);
    this.idLocalPresencial.set(null);
    this.erroEndereco.set(null);
    this.errosValidacaoEndereco.set({});
    this.enderecoCopiado.set(false);
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — MODAL DE DIRETORES
  // =========================================================================

  /**
   * criarFormDiretor()
   *
   * FormGroup do modal de designação.
   * tipoCargo: 'DE' (Diretor de Equipe) ou 'DT' (Diretor de Território).
   * nivel: habilitado/desabilitado dinamicamente por observarTipoCargo().
   * dataInicio: obrigatória, não pode ser futura.
   */
  private criarFormDiretor(): FormGroup {
    return this.fb.group({
      tipoCargo:  ['DE', Validators.required],
      nivel:      [{ value: null, disabled: true }],
      dataInicio: [this.obterDataHoje(), [Validators.required, validarDataNaoFutura]],
    });
  }

  /**
   * observarTipoCargo()
   *
   * Habilita/desabilita o controle de nivel com base no tipoCargo selecionado.
   * Quando DE: nivel é irrelevante — desabilitado e sem validator.
   * Quando DT: nivel é obrigatório — habilitado com Validators.required.
   */
  private observarTipoCargo(): void {
    const nivelControl = this.formDiretor.get('nivel')!;

    this.formDiretor.get('tipoCargo')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo: string | null) => {
        if (tipo === 'DT') {
          nivelControl.enable();
          nivelControl.setValidators(Validators.required);
        } else {
          nivelControl.reset(null);
          nivelControl.disable();
          nivelControl.clearValidators();
        }
        nivelControl.updateValueAndValidity({ emitEvent: false });
      });
  }

  /**
   * observarBuscaDiretor()
   *
   * Autocomplete do campo associado no modal de diretores.
   * Mesmo padrão de padrinhoSubject em associados.ts:
   * Subject → debounceTime(300) → switchMap → cancela requisição anterior.
   */
  private observarBuscaDiretor(): void {
    this.diretorSubject.pipe(
      debounceTime(300),
      switchMap((termo: string) => {
        const termLimpo = termo.trim();
        if (termLimpo.length < 2) {
          this.buscandoAssociadoDiretor.set(false);
          this.mostrarSugestoesDiretor.set(false);
          this.sugestoesAssociadoDiretor.set([]);
          return of(null);
        }
        this.buscandoAssociadoDiretor.set(true);
        return this.associadoService
          .listarAssociados(0, 8, { nome: termLimpo })
          .pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      if (response === null) {
        this.buscandoAssociadoDiretor.set(false);
        return;
      }
      this.sugestoesAssociadoDiretor.set(response.items);
      this.mostrarSugestoesDiretor.set(response.items.length > 0);
      this.buscandoAssociadoDiretor.set(false);
    });
  }

  /**
   * resetarFormDiretor()
   *
   * Reseta o formulário de designação mantendo tipoCargo = 'DE' e
   * dataInicio = hoje. Limpa o autocomplete de associado.
   */
  private resetarFormDiretor(): void {
    this.formDiretor.reset({ tipoCargo: 'DE', dataInicio: this.obterDataHoje() });
    this.nomeAssociadoDiretorInput.set('');
    this.idAssociadoDiretorSelecionado.set(null);
    this.sugestoesAssociadoDiretor.set([]);
    this.mostrarSugestoesDiretor.set(false);
  }

  /**
   * tratarErroDiretor(err)
   *
   * Centraliza o tratamento de erros HTTP do modal de diretores.
   * Segue CLAUDE.md SEÇÃO 12 — extrairMensagemErro já cobre os status padrão.
   */
  private tratarErroDiretor(err: HttpErrorResponse): void {
    console.error('Erro ao designar diretor:', err);
    if (err.status === 400 && err.error?.errors) {
      this.errosValidacaoDiretor.set(this.normalizarErros(err.error.errors));
      this.erroModalDiretor.set('Corrija os campos destacados.');
    } else {
      this.erroModalDiretor.set(this.extrairMensagemErro(err));
    }
    this.carregandoModalDiretor.set(false);
  }

  // =========================================================================
  // MÉTODOS PRIVADOS
  // =========================================================================

  private carregarEquipes(page: number = 0): void {
    this.carregandoLista.set(true);
    this.paginaAtual.set(page);

    this.equipesService.listarEquipes(page, this.tamanhoPagina()).subscribe({
      next: (response) => {
        console.log('Equipes carregadas:', response);
        const equipesComExtras: Equipe[] = response.items.map(equipe => ({
          ...equipe,          
          membros: equipe.numeroComponentes,
          minimoLancamento: this.MINIMO_LANCAMENTO,
        }));
        this.equipes.set(equipesComExtras);
        this.aplicarFiltros();
        this.totalEquipes.set(response.totalItems);
        this.totalPaginas.set(response.totalPages);
        this.temProxima.set(response.hasNext);
        this.temAnterior.set(response.hasPrevious);
      },
      error: (erro: HttpErrorResponse) => {
        console.error('Erro ao carregar equipes:', erro);
        this.carregandoLista.set(false);
      },
      complete: () => {
        this.carregandoLista.set(false);
      },
    });
  }

  /**
   * aplicarFiltros()
   *
   * Recalcula equipesFiltradas a partir do estado atual de equipes e filtros.
   * Chamado explicitamente após carregar dados (carregarEquipes) e ao trocar filtros.
   *
   * Por que não usar computed?
   * Em contextos de paginação, o computed pode não reagir corretamente ao ciclo
   * de atualização de signals dentro de um subscribe. O signal explícito garante
   * que o template recebe o novo array no momento certo.
   */
  private aplicarFiltros(): void {
    const termo  = this.termoBusca().toLowerCase().trim();
    const status = this.filtroStatus();
    const modelo = this.filtroModelo();

    this.equipesFiltradas.set(
      this.equipes().filter(e => {
        const baterBusca  = !termo || e.nomeEquipe.toLowerCase().includes(termo);
        const baterStatus = status === 'Todos' || e.statusEquipe === status;
        const baterModelo = modelo === 'Todos' || e.modeloReuniao === modelo;
        return baterBusca && baterStatus && baterModelo;
      })
    );
  }

  /**
   * normalizarErros(errors)
   *
   * O Spring Boot serializa erros de objetos aninhados com o caminho completo
   * da propriedade: ex. 'localPresencial.cep' → mensagem.
   * Este método remove o prefixo do objeto pai, deixando só o nome do campo
   * ('cep'), que é o que o template usa para acesso direto no errosValidacao().
   *
   * Funciona para qualquer nível de aninhamento: pega sempre o último segmento.
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
   * Extrai mensagem legível do erro HTTP do backend.
   * Segue CLAUDE.md SEÇÃO 12.2 (formato de erro do backend).
   */
  private extrairMensagemErro(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;

    if (err.error?.errors) {
      return Object.values(err.error.errors).join(' ');
    }

    if (err.status === 0) return 'Servidor indisponível. Verifique sua conexão.';

    const mensagens: Record<number, string> = {
      400: 'Erro de validação. Verifique os dados.',
      401: 'Sessão expirada. Faça login novamente.',
      403: 'Você não tem permissão para esta ação.',
      404: 'Recurso não encontrado.',
      409: 'Conflito: este registro já existe.',
      422: 'Violação de regra de negócio.',
      500: 'Erro interno do servidor. Tente novamente.',
    };

    return mensagens[err.status] ?? 'Erro desconhecido. Tente novamente.';
  }

  /**
   * Retorna a data de hoje no formato ISO 8601 (YYYY-MM-DD).
   * Usado para pré-preencher o campo dataInicioFormacao ao abrir o modal.
   */
  private obterDataHoje(): string {
    const hoje = new Date();
    const ano  = hoje.getFullYear();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia  = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * Cria o FormGroup do modal de CADASTRO com validators e valores iniciais.
   * localPresencial é um sub-grupo — presente sempre no modelo, exibido
   * condicionalmente no template com base em modeloCadastro.
   */
  private criarFormCadastro(): FormGroup {
    return this.fb.group({
      nomeEquipe:            ['C+C ', [Validators.required, Validators.maxLength(24)]],
      dataInicioFormacao:    [this.obterDataHoje()],
      dataEfetivaLancamento: [null],
      diaReuniao:            [null, Validators.required],
      horarioReuniao:        [null, Validators.required],
      modeloReuniao:         [null, Validators.required],
      linkReuniaoOnline:     [null],
      localPresencial: this.fb.group({
        rua:          [''],
        numero:       [''],
        complemento:  [null],
        bairro:       [''],
        cidade:       [''],
        uf:           ['', Validators.maxLength(2)],
        cep:          [''],
      }),
    });
  }

  /**
   * observarModeloCadastro()
   *
   * Assina as mudanças do campo modeloReuniao no formCadastro.
   * Quando o modelo é PRESENCIAL ou HIBRIDO, os campos de endereço tornam-se
   * obrigatórios — o que desabilita automaticamente o botão "Salvar Equipe"
   * (que já depende de formCadastro.invalid).
   * Quando o modelo volta para ONLINE, os validators são removidos.
   *
   * Por que takeUntilDestroyed?
   * valueChanges é um Observable infinito. Sem cancelamento, a subscription
   * vaza após o componente ser destruído. takeUntilDestroyed se integra ao
   * ciclo de vida do Angular e cancela automaticamente no destroy.
   */
  private observarModeloCadastro(): void {
    this.formCadastro.get('modeloReuniao')!
      .valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modelo: ModeloReuniao | null) => {
        this.atualizarValidacaoEnderecoObrigatorio(modelo, this.formCadastro);
      });
  }

  /**
   * observarModeloEdicao()
   *
   * Mesmo comportamento do observarModeloCadastro(), mas para o formEdicao.
   * Necessário porque o modal de edição agora também exibe o sub-grupo
   * localPresencial condicionalmente, com validação dinâmica.
   */
  private observarModeloEdicao(): void {
    this.formEdicao.get('modeloReuniao')!
      .valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modelo: ModeloReuniao | null) => {
        this.atualizarValidacaoEnderecoObrigatorio(modelo, this.formEdicao);
      });
  }

  /**
   * atualizarValidacaoEnderecoObrigatorio(modelo, form)
   *
   * Adiciona ou remove Validators.required nos campos do sub-grupo localPresencial
   * com base no modelo de reunião selecionado.
   * Recebe o FormGroup pai como parâmetro para funcionar tanto no cadastro
   * quanto na edição sem duplicar lógica.
   *
   * Campos com required: rua, numero, bairro, cidade, uf, cep.
   * Complemento permanece sempre opcional (regra de negócio do PRD).
   *
   * Após cada alteração de validator, updateValueAndValidity() força o Angular
   * a recalcular a validade do campo e do formulário pai — necessário para que
   * form.invalid reflita o novo estado imediatamente.
   */
  private atualizarValidacaoEnderecoObrigatorio(modelo: ModeloReuniao | null, form: FormGroup): void {
    const localGroup = form.get('localPresencial');
    if (!localGroup) return;

    const camposObrigatorios = ['rua', 'numero', 'bairro', 'cidade', 'uf', 'cep'];
    const enderecoObrigatorio = modelo === 'PRESENCIAL' || modelo === 'HIBRIDO';

    camposObrigatorios.forEach(campo => {
      const control = localGroup.get(campo);
      if (!control) return;

      if (enderecoObrigatorio) {
        control.setValidators(Validators.required);
      } else {
        control.clearValidators();
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  /**
   * Cria o FormGroup do modal de ENDEREÇO PRESENCIAL.
   * Campos espelham LocalPresencialSemIdDto (sem o idEquipe, preenchido pelo service).
   */
  private criarFormEndereco(): FormGroup {
    return this.fb.group({
      idEquipe:    [null], // Preenchido pelo service, não exposto no template
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      uf:          ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', Validators.required],
    });
  }

  /**
   * Cria o FormGroup do modal de EDIÇÃO.
   * Inclui localPresencial como sub-grupo — exibido condicionalmente quando
   * modeloReuniao ≠ ONLINE. Os validators são adicionados dinamicamente
   * via observarModeloEdicao(), igual ao fluxo de cadastro.
   */
  private criarFormEdicao(): FormGroup {
    return this.fb.group({
      nomeEquipe:            ['C+C ', [Validators.required, Validators.maxLength(24)]],
      dataInicioFormacao:    [null],
      dataEfetivaLancamento: [null],
      diaReuniao:            [null, Validators.required],
      horarioReuniao:        [null, Validators.required],
      modeloReuniao:         [null, Validators.required],
      linkReuniaoOnline:     [null],
      localPresencial: this.fb.group({
        rua:         [''],
        numero:      [''],
        complemento: [null],
        bairro:      [''],
        cidade:      [''],
        uf:          ['', Validators.maxLength(2)],
        cep:         [''],
      }),
    });
  }
}
