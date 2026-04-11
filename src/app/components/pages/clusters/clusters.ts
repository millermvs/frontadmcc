import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ClusterService } from '../../../services/cluster.service';
import {
  ClusterResponseDto,
  ClusterRequestDto,
  AtuacaoEspecificaResponseDto,
  AtuacaoEspecificaRequestDto,
} from '../../../models/cluster.model';

/**
 * CLUSTERS PAGE COMPONENT
 *
 * Página de gerenciamento de Clusters e Atuações Específicas.
 * Exibe duas tabelas na mesma página (relação mestre-detalhe):
 *   - Tabela superior: Clusters (CRUD)
 *   - Tabela inferior: Atuações Específicas (CRUD, filtráveis por cluster)
 *
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Exibe dados vindos do ClusterService
 * - Captura ações do usuário (filtros, cliques, submit)
 * - Delega toda lógica ao Service (sem HTTP direto)
 *
 * Carregamento paralelo via forkJoin (CLAUDE.md §7.3 — proíbe nested subscribes).
 */
@Component({
  selector: 'app-clusters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clusters.html',
  styleUrl: './clusters.css',
})
export class Clusters implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private clusterService = inject(ClusterService);
  private fb             = inject(FormBuilder);

  // =========================================================================
  // VIEWCHILD — referências aos botões ocultos de fechar modal
  //
  // Por que ViewChild? CLAUDE.md §2.2 proíbe manipulação direta do DOM.
  // ViewChild é a forma Angular idiomática de referenciar elementos do template.
  // =========================================================================

  @ViewChild('btnFecharModalNovoCluster')
  private btnFecharNovoCluster!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEditarCluster')
  private btnFecharEditarCluster!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalNovaAtuacao')
  private btnFecharNovaAtuacao!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEditarAtuacao')
  private btnFecharEditarAtuacao!: ElementRef<HTMLButtonElement>;

  // =========================================================================
  // SIGNALS — DADOS
  // =========================================================================

  clusters    = signal<ClusterResponseDto[]>([]);
  atuacoes    = signal<AtuacaoEspecificaResponseDto[]>([]);
  carregandoLista = signal(false);

  // =========================================================================
  // SIGNALS — FILTROS
  // =========================================================================

  termoBuscaCluster    = signal('');
  termoBuscaAtuacao    = signal('');

  /**
   * null = "Todos os clusters" (sem filtro).
   * number = filtra atuações pelo idCluster selecionado.
   */
  filtroClusterAtuacao = signal<number | null>(null);

  // =========================================================================
  // SIGNALS — ESTADO DOS MODAIS
  // =========================================================================

  carregandoModal = signal(false);
  erroModal       = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend (400).
   * Chave = nome do campo, valor = mensagem de validação.
   */
  errosValidacao  = signal<Record<string, string>>({});

  /**
   * ID do cluster sendo editado. null = nenhum (modo cadastro).
   */
  idClusterParaAtualizar = signal<number | null>(null);

  /**
   * ID da atuação sendo editada. null = nenhum (modo cadastro).
   */
  idAtuacaoParaAtualizar = signal<number | null>(null);

  // =========================================================================
  // FORMULÁRIOS REATIVOS
  //
  // Cluster: 1 campo (nome). Atuação: 2 campos (nome + idCluster).
  // Mesmo sendo simples, ReactiveFormsModule mantém consistência com o restante
  // do projeto e facilita validação programática.
  // =========================================================================

  formNovoCluster:    FormGroup = this.criarFormCluster();
  formEditarCluster:  FormGroup = this.criarFormCluster();
  formNovaAtuacao:    FormGroup = this.criarFormAtuacao();
  formEditarAtuacao:  FormGroup = this.criarFormAtuacao();

  // =========================================================================
  // COMPUTED — KPI CARDS
  // =========================================================================

  totalClusters = computed(() => this.clusters().length);
  totalAtuacoes = computed(() => this.atuacoes().length);

  // =========================================================================
  // COMPUTED — FILTROS DE TABELA
  //
  // computed() em vez de métodos: recalcula automaticamente quando qualquer
  // signal lido internamente mudar (CLAUDE.md §7.2).
  // =========================================================================

  clustersFiltrados = computed(() => {
    const termo = this.termoBuscaCluster().toLowerCase().trim();
    return this.clusters().filter(c =>
      !termo || c.nome.toLowerCase().includes(termo)
    );
  });

  atuacoesFiltradas = computed(() => {
    const termo     = this.termoBuscaAtuacao().toLowerCase().trim();
    const idCluster = this.filtroClusterAtuacao();

    return this.atuacoes().filter(a => {
      const baterBusca    = !termo || a.nome.toLowerCase().includes(termo);
      const baterCluster  = idCluster === null || a.idCluster === idCluster;
      return baterBusca && baterCluster;
    });
  });

  /**
   * Conta as atuações de um cluster específico (exibido na tabela de clusters).
   * Usa computed internamente via chamada direta — derivado de atuacoes().
   */
  contarAtuacoesPorCluster(idCluster: number): number {
    return this.atuacoes().filter(a => a.idCluster === idCluster).length;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregarDados();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS
  // =========================================================================

  atualizarBuscaCluster(valor: string): void { this.termoBuscaCluster.set(valor); }
  atualizarBuscaAtuacao(valor: string): void { this.termoBuscaAtuacao.set(valor); }

  atualizarFiltroCluster(valor: string): void {
    this.filtroClusterAtuacao.set(valor === 'Todos' ? null : Number(valor));
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — RESET DOS MODAIS
  // =========================================================================

  resetarFormNovoCluster(): void {
    this.formNovoCluster.reset();
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  resetarFormEditarCluster(): void {
    this.formEditarCluster.reset();
    this.idClusterParaAtualizar.set(null);
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  resetarFormNovaAtuacao(): void {
    this.formNovaAtuacao.reset();
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  resetarFormEditarAtuacao(): void {
    this.formEditarAtuacao.reset();
    this.idAtuacaoParaAtualizar.set(null);
    this.errosValidacao.set({});
    this.erroModal.set(null);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CLUSTER: CADASTRAR
  // =========================================================================

  salvarNovoCluster(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const dto: ClusterRequestDto = this.formNovoCluster.getRawValue();

    this.clusterService.cadastrarCluster(dto).subscribe({
      next: () => {
        this.btnFecharNovoCluster.nativeElement.click();
        this.formNovoCluster.reset();
        this.carregarDados();
        // TODO: toastService.sucesso('Cluster cadastrado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CLUSTER: EDITAR
  // =========================================================================

  /**
   * Preenche o formulário de edição e registra qual cluster está sendo editado.
   * O Bootstrap abre o modal pelo data-bs-toggle no botão da tabela.
   */
  abrirModalEditarCluster(cluster: ClusterResponseDto): void {
    this.idClusterParaAtualizar.set(cluster.idCluster);
    this.errosValidacao.set({});
    this.erroModal.set(null);
    this.formEditarCluster.patchValue({ nome: cluster.nome });
    // patchValue() preenche os campos mas NÃO marca o formulário como dirty —
    // o Angular só considera dirty após interação do usuário.
    // markAsDirty() força o estado sujo explicitamente, habilitando o botão
    // "Salvar Alterações" assim que o modal abre com os dados pré-preenchidos.
    this.formEditarCluster.markAsDirty();
  }

  salvarEditarCluster(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const dto: ClusterRequestDto = this.formEditarCluster.getRawValue();

    this.clusterService.editarCluster(this.idClusterParaAtualizar()!, dto).subscribe({
      next: () => {
        this.btnFecharEditarCluster.nativeElement.click();
        this.formEditarCluster.reset();
        this.idClusterParaAtualizar.set(null);
        this.carregarDados();
        // TODO: toastService.sucesso('Cluster atualizado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — ATUAÇÃO: CADASTRAR
  // =========================================================================

  /**
   * Pré-seleciona o cluster no formulário de nova atuação quando o usuário
   * clica em "Nova Atuação" a partir de um cluster específico na tabela.
   * Aceita null para quando o botão global "Nova Atuação" é usado.
   */
  abrirModalNovaAtuacao(idClusterPreSelecionado: number | null = null): void {
    this.errosValidacao.set({});
    this.erroModal.set(null);
    this.formNovaAtuacao.reset();
    if (idClusterPreSelecionado !== null) {
      this.formNovaAtuacao.patchValue({ idCluster: idClusterPreSelecionado });
    }
  }

  salvarNovaAtuacao(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const dto: AtuacaoEspecificaRequestDto = this.formNovaAtuacao.getRawValue();

    this.clusterService.cadastrarAtuacao(dto).subscribe({
      next: () => {
        this.btnFecharNovaAtuacao.nativeElement.click();
        this.formNovaAtuacao.reset();
        this.carregarDados();
        // TODO: toastService.sucesso('Atuação cadastrada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — ATUAÇÃO: EDITAR
  // =========================================================================

  abrirModalEditarAtuacao(atuacao: AtuacaoEspecificaResponseDto): void {
    this.idAtuacaoParaAtualizar.set(atuacao.id);
    this.errosValidacao.set({});
    this.erroModal.set(null);
    this.formEditarAtuacao.patchValue({
      nome:      atuacao.nome,
      idCluster: atuacao.idCluster,
    });
    // Mesmo motivo do abrirModalEditarCluster — patchValue não marca dirty.
    this.formEditarAtuacao.markAsDirty();
  }

  salvarEditarAtuacao(): void {
    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const dto: AtuacaoEspecificaRequestDto = this.formEditarAtuacao.getRawValue();

    this.clusterService.editarAtuacao(this.idAtuacaoParaAtualizar()!, dto).subscribe({
      next: () => {
        this.btnFecharEditarAtuacao.nativeElement.click();
        this.formEditarAtuacao.reset();
        this.idAtuacaoParaAtualizar.set(null);
        this.carregarDados();
        // TODO: toastService.sucesso('Atuação atualizada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS
  // =========================================================================

  /**
   * carregarDados()
   *
   * Carrega clusters e atuações em paralelo via forkJoin.
   *
   * Por que forkJoin?
   * As duas chamadas são independentes — não há motivo para esperar uma terminar
   * antes de disparar a outra. forkJoin dispara as duas ao mesmo tempo e emite
   * um único resultado quando AMBAS completarem (CLAUDE.md §7.3).
   */
  private carregarDados(): void {
    this.carregandoLista.set(true);

    forkJoin({
      clusters: this.clusterService.listarClusters(0, 20),
      atuacoes: this.clusterService.listarAtuacoes(0, 20), 
    }).subscribe({
      next: ({ clusters, atuacoes }) => {
        // Operador ?. protege contra resposta null/undefined do backend.
        // ?? [] garante que o signal nunca receba undefined — sem isso,
        // clustersFiltrados().filter() lançaria TypeError silencioso e
        // carregandoLista ficaria true para sempre (complete não chegaria a rodar).
        this.clusters.set(clusters?.items ?? []);
        this.atuacoes.set(atuacoes?.items ?? []);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados:', err);
        // Garante estado limpo mesmo em caso de erro (ex: 401, 500, rede)
        this.clusters.set([]);
        this.atuacoes.set([]);
        this.carregandoLista.set(false);
      },
      complete: () => {
        this.carregandoLista.set(false);
      },
    });
  }

  /**
   * tratarErroModal()
   *
   * Centraliza o tratamento de erros dos 4 formulários do modal.
   * Separa erros de validação por campo (400) de erros genéricos.
   */
  private tratarErroModal(err: HttpErrorResponse): void {
    if (err.status === 400 && err.error?.errors) {
      this.errosValidacao.set(err.error.errors);
      this.erroModal.set('Corrija os campos destacados.');
    } else {
      this.erroModal.set(this.extrairMensagemErro(err));
    }
  }

  private extrairMensagemErro(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Servidor indisponível. Verifique sua conexão.';

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

  private criarFormCluster(): FormGroup {
    return this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(100)]],
    });
  }

  private criarFormAtuacao(): FormGroup {
    return this.fb.group({
      nome:      ['', [Validators.required, Validators.maxLength(150)]],
      idCluster: [null, Validators.required],
    });
  }
}
