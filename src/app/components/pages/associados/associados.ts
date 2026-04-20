import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  AssociadoResponseDto,
  LABELS_STATUS_ASSOCIADO,
  STATUS_ASSOCIADO_OPCOES,
  StatusAssociado,
} from '../../../models/associado.model';
import { EquipeResponseDto } from '../../../models/equipe.model';
import { AssociadoService } from '../../../services/associado.service';
import { EquipeService } from '../../../services/equipe.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  private equipeService    = inject(EquipeService);
  private destroyRef       = inject(DestroyRef);   // reservado para subscriptions futuras (modais)

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
    // Conecta o debounce de busca antes de carregar os dados
    this.buscaSubject.pipe(
      debounceTime(1000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.carregarAssociados(0));

    this.carregarAssociados();
    this.carregarEquipes();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS
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
  // MÉTODOS PRIVADOS
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
   * Carrega lista de equipes para popular o select de filtro.
   * Usa size=100 para trazer todas as equipes em uma única requisição.
   * Não exibe erro para o usuário — o select simplesmente fica sem as opções.
   */
  private carregarEquipes(): void {
    this.equipeService.listarEquipes(0, 100).subscribe({
      next: (response) => this.equipes.set(response.items),
      error: (err) => console.error('Erro ao carregar equipes para filtro:', err),
    });
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
