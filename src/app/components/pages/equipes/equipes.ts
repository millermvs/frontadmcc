import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EquipeService } from '../../../services/equipe.service';
import {
  EquipeResponseDto,
  EquipeRequestDto,
  LocalPresencialSemIdDto,
  ModeloReuniao,
  LABELS_DIA,
  LABELS_MODELO,
  LABELS_HORARIO,
  LABELS_STATUS,
} from '../../../models/equipe.model';

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

  private equipesService = inject(EquipeService);
  private fb = inject(FormBuilder);

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

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca      = signal('');
  filtroStatus    = signal<string>('Todos');
  filtroModelo    = signal<string>('Todos');
  equipes         = signal<Equipe[]>([]);
  carregandoLista = signal(false);

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
  // FORMULÁRIOS REATIVOS
  //
  // Por que ReactiveFormsModule?
  // CLAUDE.md §8.1: formulários com 6+ campos devem usar ReactiveFormsModule
  // + FormBuilder. O modal de equipe tem 10+ campos.
  // =========================================================================

  formCadastro: FormGroup = this.criarFormCadastro();
  formEdicao: FormGroup   = this.criarFormEdicao();

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
  // COMPUTED — FILTROS
  // =========================================================================

  equipesFiltradas = computed(() => {
    const termo  = this.termoBusca().toLowerCase().trim();
    const status = this.filtroStatus();
    const modelo = this.filtroModelo();

    return this.equipes().filter(e => {
      const baterBusca  = !termo || e.nomeEquipe.toLowerCase().includes(termo);
      const baterStatus = status === 'Todos' || e.statusEquipe === status;
      const baterModelo = modelo === 'Todos' || e.modeloReuniao === modelo;
      return baterBusca && baterStatus && baterModelo;
    });
  });

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
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS
  // =========================================================================

  atualizarBusca(valor: string): void         { this.termoBusca.set(valor); }
  atualizarFiltroStatus(valor: string): void  { this.filtroStatus.set(valor); }
  atualizarFiltroModelo(valor: string): void  { this.filtroModelo.set(valor); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — RESET DOS MODAIS
  // =========================================================================

  /**
   * Reseta o formulário de CADASTRO ao estado inicial.
   * Chamado pelo botão Cancelar e pelo ícone X do modal de criação.
   */
  resetarFormulario(): void {
    this.formCadastro.reset({ dataInicioFormacao: this.obterDataHoje() });
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
   * Extrai os valores do formCadastro, monta os DTOs tipados e delega ao service.
   *
   * Decide qual local passar ao service:
   *   - ONLINE → null (service não chama o segundo endpoint)
   *   - PRESENCIAL / HIBRIDO → localPresencial (service encadeia os dois POSTs)
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
    };

    const local: LocalPresencialSemIdDto | null = val.modeloReuniao !== 'ONLINE'
      ? (val.localPresencial as LocalPresencialSemIdDto)
      : null;

    this.equipesService.cadastrarEquipe(equipeDto, local).subscribe({
      next: () => {
        this.btnFecharCadastro.nativeElement.click();
        this.formCadastro.reset({ dataInicioFormacao: this.obterDataHoje() });
        this.errosValidacao.set({});
        this.carregarEquipes();
        // TODO: toastService.sucesso('Equipe cadastrada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(err.error.errors);
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
    };

    this.equipesService.editarEquipe(this.idEquipeParaAtualizar()!, equipeDto).subscribe({
      next: () => {
        this.btnFecharEdicao.nativeElement.click();
        this.formEdicao.reset();
        this.idEquipeParaAtualizar.set(null);
        this.errosValidacao.set({});
        this.carregarEquipes();
        // TODO: toastService.sucesso('Equipe atualizada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(err.error.errors);
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
  // MÉTODOS PRIVADOS
  // =========================================================================

  private carregarEquipes(): void {
    this.carregandoLista.set(true);

    this.equipesService.listarEquipes(0, 100).subscribe({
      next: (response) => {
        const equipesComExtras: Equipe[] = response.items.map(equipe => ({
          ...equipe,
          membros: 0,                           // TODO: usar equipe.numeroComponentes
          minimoLancamento: this.MINIMO_LANCAMENTO,
        }));
        this.equipes.set(equipesComExtras);
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
      nomeEquipe:            ['', [Validators.required, Validators.maxLength(24)]],
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
   * Cria o FormGroup do modal de EDIÇÃO.
   * Sem localPresencial — edição de endereço será implementada em sprint dedicado.
   */
  private criarFormEdicao(): FormGroup {
    return this.fb.group({
      nomeEquipe:            ['', [Validators.required, Validators.maxLength(24)]],
      dataInicioFormacao:    [null],
      dataEfetivaLancamento: [null],
      diaReuniao:            [null, Validators.required],
      horarioReuniao:        [null, Validators.required],
      modeloReuniao:         [null, Validators.required],
      linkReuniaoOnline:     [null],
    });
  }
}
