import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import {
  AssociadoResponseDto,
  LABELS_STATUS_ASSOCIADO,
  STATUS_ASSOCIADO_OPCOES,
  StatusAssociado,
} from '../../../models/associado.model';
import { AssociadoService } from '../../../services/associado.service';

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
 * Implementação em blocos:
 *   Bloco 2.1 (atual): estrutura base — signals, injeções, listagem inicial
 *   Bloco 2.2: KPI cards no template
 *   Bloco 2.3: barra de filtros e tabela
 *   Bloco 2.4: controles de paginação
 *   Bloco 3+:  modais de cadastro, edição e alterar status
 */
@Component({
  selector: 'app-associados',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './associados.html',
  styleUrl: './associados.css',
})
export class Associados implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private associadoService = inject(AssociadoService);
  private destroyRef       = inject(DestroyRef);   // reservado para subscriptions futuras (modais)

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca          = signal('');
  filtroStatus        = signal<string>('Todos');
  associados          = signal<AssociadoResponseDto[]>([]);
  associadosFiltrados = signal<AssociadoResponseDto[]>([]);
  totalAssociados     = signal(0);
  carregandoLista     = signal(false);

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
  // computed() é o mecanismo correto aqui: os valores derivam diretamente
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
    this.carregarAssociados();
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
  // MÉTODOS PRIVADOS
  // =========================================================================

  /**
   * carregarAssociados(page)
   *
   * Chama o service e atualiza os signals de listagem e paginação.
   * Após receber os dados, dispara aplicarFiltros() para que a tabela
   * exiba apenas o subconjunto correspondente aos filtros ativos.
   */
  private carregarAssociados(page: number = 0): void {
    this.carregandoLista.set(true);
    this.paginaAtual.set(page);

    this.associadoService.listarAssociados(page, this.tamanhoPagina()).subscribe({
      next: (response) => {
        this.associados.set(response.items);
        this.aplicarFiltros();
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
   * aplicarFiltros()
   *
   * Recalcula associadosFiltrados a partir do estado atual de associados e filtros.
   * A busca aceita nome completo ou CPF (insensível a maiúsculas/minúsculas).
   *
   * Por que signal explícito em vez de computed()?
   * Em contextos de paginação, o computed pode não reagir corretamente ao ciclo
   * de atualização de signals dentro de um subscribe. O signal explícito garante
   * que o template recebe o novo array no momento certo — mesmo padrão do equipes.ts.
   */
  private aplicarFiltros(): void {
    const termo  = this.termoBusca().toLowerCase().trim();
    const status = this.filtroStatus();

    this.associadosFiltrados.set(
      this.associados().filter(a => {
        const baterBusca  = !termo
          || a.nomeCompleto.toLowerCase().includes(termo)
          || a.cpf.includes(termo);
        const baterStatus = status === 'Todos' || a.statusAssociado === status;
        return baterBusca && baterStatus;
      })
    );
  }

  /**
   * extrairMensagemErro(err)
   *
   * Extrai mensagem legível do erro HTTP retornado pelo backend.
   * Segue CLAUDE.md SEÇÃO 12 (formato de erro do backend).
   * Disponível para os blocos seguintes que implementarão modais.
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
      409: 'Conflito: este registro já existe.',
      422: 'Violação de regra de negócio.',
      500: 'Erro interno do servidor. Tente novamente.',
    };

    return mensagens[err.status] ?? 'Erro desconhecido. Tente novamente.';
  }
}
