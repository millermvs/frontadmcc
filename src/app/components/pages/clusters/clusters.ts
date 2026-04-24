import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ClusterService } from '../../../services/cluster.service';
import { ToastService } from '../../../services/toast.service';
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
 * Exibe duas tabelas LADO A LADO (colunas Bootstrap):
 *   - Coluna esquerda : Clusters (CRUD + paginação independente)
 *   - Coluna direita  : Atuações Específicas (CRUD + paginação independente)
 *
 * Filtro por cluster via backend (endpoint /atuacoes-especificas/cluster/:id).
 * Ao clicar no botão "briefcase" de um cluster:
 *   - Apenas aquela linha permanece visível na tabela de clusters.
 *   - Atuações carregadas do backend filtradas por esse cluster.
 *   - Botão briefcase é substituído pelo botão "X" para limpar o filtro.
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
  private toastService   = inject(ToastService);
  private fb             = inject(FormBuilder);

  // =========================================================================
  // VIEWCHILD — referências aos botões ocultos de fechar modal
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

  clusters = signal<ClusterResponseDto[]>([]);
  atuacoes = signal<AtuacaoEspecificaResponseDto[]>([]);

  // =========================================================================
  // SIGNALS — LOADING (independentes por tabela)
  // =========================================================================

  carregandoClusters = signal(false);
  carregandoAtuacoes = signal(false);

  // =========================================================================
  // SIGNALS — FILTROS DE TEXTO
  // =========================================================================

  termoBuscaCluster = signal('');
  termoBuscaAtuacao = signal('');

  /**
   * null  = sem filtro de cluster ativo.
   * ClusterResponseDto = cluster selecionado para pesquisa de atuações via backend.
   *
   * Quando não-null:
   *  - A tabela de clusters exibe APENAS a linha deste cluster.
   *  - A tabela de atuações exibe apenas as atuações deste cluster (via backend).
   *  - O botão "briefcase" da linha é substituído pelo botão "X" (limpar).
   */
  clusterFiltrado = signal<ClusterResponseDto | null>(null);

  // =========================================================================
  // SIGNALS — PAGINAÇÃO CLUSTERS
  // =========================================================================

  paginaAtualClusters    = signal(0);
  tamanhoPaginaClusters  = signal(10);
  totalPaginasClusters   = signal(0);
  temProximaClusters     = signal(false);
  temAnteriorClusters    = signal(false);
  totalItensClusters     = signal(0);

  // =========================================================================
  // SIGNALS — PAGINAÇÃO ATUAÇÕES
  // =========================================================================

  paginaAtualAtuacoes    = signal(0);
  tamanhoPaginaAtuacoes  = signal(10);
  totalPaginasAtuacoes   = signal(0);
  temProximaAtuacoes     = signal(false);
  temAnteriorAtuacoes    = signal(false);
  totalItensAtuacoes     = signal(0);

  // =========================================================================
  // SIGNALS — ESTADO DOS MODAIS
  // =========================================================================

  carregandoModal    = signal(false);
  erroModal          = signal<string | null>(null);
  errosValidacao     = signal<Record<string, string>>({});
  idClusterParaAtualizar = signal<number | null>(null);
  idAtuacaoParaAtualizar = signal<number | null>(null);

  // =========================================================================
  // FORMULÁRIOS REATIVOS
  // =========================================================================

  formNovoCluster:   FormGroup = this.criarFormCluster();
  formEditarCluster: FormGroup = this.criarFormCluster();
  formNovaAtuacao:   FormGroup = this.criarFormAtuacao();
  formEditarAtuacao: FormGroup = this.criarFormAtuacao();

  // =========================================================================
  // COMPUTED — FILTROS DE TABELA
  // =========================================================================

  /**
   * Quando clusterFiltrado() não é null: retorna APENAS aquela linha.
   * Caso contrário: aplica filtro de texto na página carregada.
   */
  clustersFiltrados = computed(() => {
    const filtrado = this.clusterFiltrado();
    if (filtrado !== null) {
      return [filtrado];
    }
    const termo = this.termoBuscaCluster().toLowerCase().trim();
    return this.clusters().filter(c =>
      !termo || c.nome.toLowerCase().includes(termo)
    );
  });

  /**
   * Filtro de texto local sobre os itens da página atual de atuações.
   * O filtro por cluster é delegado ao backend via pesquisarPorCluster().
   */
  atuacoesFiltradas = computed(() => {
    const termo = this.termoBuscaAtuacao().toLowerCase().trim();
    return this.atuacoes().filter(a =>
      !termo || a.nome.toLowerCase().includes(termo)
    );
  });

  /**
   * Contagem de atuações exibida no badge da tabela de clusters.
   *
   * Quando o cluster em questão É o filtro ativo, usa o total do backend
   * (preciso, mesmo com paginação). Caso contrário, conta os itens carregados
   * na página atual (pode ser parcial — trade-off consciente com paginação).
   */
  contarAtuacoesPorCluster(idCluster: number): number {
    const filtrado = this.clusterFiltrado();
    if (filtrado !== null && filtrado.idCluster === idCluster) {
      return this.totalItensAtuacoes();
    }
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

  /**
   * Ativa a pesquisa de atuações por cluster (via backend).
   * Apenas o cluster clicado permanece visível na tabela de clusters.
   * O botão "briefcase" da linha é substituído pelo "X".
   */
  pesquisarPorCluster(cluster: ClusterResponseDto): void {
    this.clusterFiltrado.set(cluster);
    this.carregarAtuacoes(0);
  }

  /**
   * Remove o filtro de cluster e recarrega ambas as tabelas a partir da página 0.
   */
  limparPesquisaCluster(): void {
    this.clusterFiltrado.set(null);
    this.carregarClusters(0);
    this.carregarAtuacoes(0);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO CLUSTERS
  // =========================================================================

  totalPaginasClustersArray(): number[] {
    return Array.from({ length: this.totalPaginasClusters() }, (_, i) => i);
  }

  irParaPaginaClusters(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginasClusters()) return;
    this.carregarClusters(pagina);
  }

  proximaPaginaClusters(): void  { this.irParaPaginaClusters(this.paginaAtualClusters() + 1); }
  paginaAnteriorClusters(): void { this.irParaPaginaClusters(this.paginaAtualClusters() - 1); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO ATUAÇÕES
  // =========================================================================

  totalPaginasAtuacoesArray(): number[] {
    return Array.from({ length: this.totalPaginasAtuacoes() }, (_, i) => i);
  }

  irParaPaginaAtuacoes(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginasAtuacoes()) return;
    this.carregarAtuacoes(pagina);
  }

  proximaPaginaAtuacoes(): void  { this.irParaPaginaAtuacoes(this.paginaAtualAtuacoes() + 1); }
  paginaAnteriorAtuacoes(): void { this.irParaPaginaAtuacoes(this.paginaAtualAtuacoes() - 1); }

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
        this.recarregarAposModal();
        this.toastService.sucesso('Cluster cadastrado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CLUSTER: EDITAR
  // =========================================================================

  abrirModalEditarCluster(cluster: ClusterResponseDto): void {
    this.idClusterParaAtualizar.set(cluster.idCluster);
    this.errosValidacao.set({});
    this.erroModal.set(null);
    this.formEditarCluster.patchValue({ nome: cluster.nome });
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
        this.recarregarAposModal();
        this.toastService.sucesso('Cluster atualizado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — ATUAÇÃO: CADASTRAR
  // =========================================================================

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
        this.recarregarAposModal();
        this.toastService.sucesso('Atuação específica cadastrada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
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
        this.recarregarAposModal();
        this.toastService.sucesso('Atuação específica atualizada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        this.tratarErroModal(err);
        this.carregandoModal.set(false);
      },
      complete: () => { this.carregandoModal.set(false); },
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS
  // =========================================================================

  /**
   * carregarDados()
   *
   * Carregamento inicial paralelo via forkJoin — usado apenas no ngOnInit.
   * Reseta o filtro de cluster ativo para garantir estado limpo na entrada.
   */
  private carregarDados(): void {
    this.carregandoClusters.set(true);
    this.carregandoAtuacoes.set(true);
    this.clusterFiltrado.set(null);

    forkJoin({
      clusters: this.clusterService.listarClusters(0, this.tamanhoPaginaClusters()),
      atuacoes: this.clusterService.listarAtuacoes(0, this.tamanhoPaginaAtuacoes()),
    }).subscribe({
      next: ({ clusters, atuacoes }) => {
        // Clusters
        this.clusters.set(clusters?.items ?? []);
        this.paginaAtualClusters.set(clusters?.page ?? 0);
        this.totalPaginasClusters.set(clusters?.totalPages ?? 0);
        this.temProximaClusters.set(clusters?.hasNext ?? false);
        this.temAnteriorClusters.set(clusters?.hasPrevious ?? false);
        this.totalItensClusters.set(Number(clusters?.totalItems ?? 0));

        // Atuações
        this.atuacoes.set(atuacoes?.items ?? []);
        this.paginaAtualAtuacoes.set(atuacoes?.page ?? 0);
        this.totalPaginasAtuacoes.set(atuacoes?.totalPages ?? 0);
        this.temProximaAtuacoes.set(atuacoes?.hasNext ?? false);
        this.temAnteriorAtuacoes.set(atuacoes?.hasPrevious ?? false);
        this.totalItensAtuacoes.set(Number(atuacoes?.totalItems ?? 0));
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados:', err);
        this.clusters.set([]);
        this.atuacoes.set([]);
        this.carregandoClusters.set(false);
        this.carregandoAtuacoes.set(false);
      },
      complete: () => {
        this.carregandoClusters.set(false);
        this.carregandoAtuacoes.set(false);
      },
    });
  }

  /**
   * recarregarAposModal()
   *
   * Chamado após operações de CRUD para recarregar as tabelas.
   * Preserva o estado de filtro de cluster ativo, ao contrário de carregarDados().
   * Sempre recarrega ambas as tabelas a partir da página 0.
   */
  private recarregarAposModal(): void {
    this.carregarClusters(0);
    this.carregarAtuacoes(0);
  }

  /**
   * carregarClusters()
   *
   * Carrega apenas a tabela de clusters (paginação independente).
   * Não afeta a tabela de atuações nem o filtro de cluster ativo.
   */
  private carregarClusters(pagina: number): void {
    this.carregandoClusters.set(true);

    this.clusterService.listarClusters(pagina, this.tamanhoPaginaClusters()).subscribe({
      next: (response) => {
        this.clusters.set(response?.items ?? []);
        this.paginaAtualClusters.set(response?.page ?? 0);
        this.totalPaginasClusters.set(response?.totalPages ?? 0);
        this.temProximaClusters.set(response?.hasNext ?? false);
        this.temAnteriorClusters.set(response?.hasPrevious ?? false);
        this.totalItensClusters.set(Number(response?.totalItems ?? 0));
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar clusters:', err);
        this.clusters.set([]);
        this.carregandoClusters.set(false);
      },
      complete: () => { this.carregandoClusters.set(false); },
    });
  }

  /**
   * carregarAtuacoes()
   *
   * Carrega a tabela de atuações respeitando o estado de filtro:
   *   - Se clusterFiltrado() não é null → usa endpoint por cluster.
   *   - Se null → usa endpoint geral.
   *
   * Por que verificar o signal aqui e não receber o ID como parâmetro?
   * Porque pesquisarPorCluster() seta o signal ANTES de chamar carregarAtuacoes(),
   * garantindo consistência entre o estado visual e os dados carregados.
   */
  private carregarAtuacoes(pagina: number): void {
    this.carregandoAtuacoes.set(true);

    const filtrado    = this.clusterFiltrado();
    const observable  = filtrado !== null
      ? this.clusterService.listarAtuacoesPorCluster(filtrado.idCluster, pagina, this.tamanhoPaginaAtuacoes())
      : this.clusterService.listarAtuacoes(pagina, this.tamanhoPaginaAtuacoes());

    observable.subscribe({
      next: (response) => {
        this.atuacoes.set(response?.items ?? []);
        this.paginaAtualAtuacoes.set(response?.page ?? 0);
        this.totalPaginasAtuacoes.set(response?.totalPages ?? 0);
        this.temProximaAtuacoes.set(response?.hasNext ?? false);
        this.temAnteriorAtuacoes.set(response?.hasPrevious ?? false);
        this.totalItensAtuacoes.set(Number(response?.totalItems ?? 0));
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar atuações:', err);
        this.atuacoes.set([]);
        this.carregandoAtuacoes.set(false);
      },
      complete: () => { this.carregandoAtuacoes.set(false); },
    });
  }

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
