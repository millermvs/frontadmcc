import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  ConexaoGeradaResponseDto,
  ConexaoRecebidaResponseDto,
  StatusConexao,
  TipoConexao,
} from '../../../models/conexao.model';
import { ConexaoService } from '../../../services/conexao.service';
import { ToastService } from '../../../services/toast.service';

// Tipo interno — controla qual aba está visível.
// Sem export: é uma estrutura privada deste componente.
type AbaAtiva = 'geradas' | 'recebidas';

/**
 * CONEXOES PAGE COMPONENT — Parte 3
 *
 * Página do módulo de Conexões (Fase 4 — Operacional).
 *
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Exibe dados vindos do ConexaoService
 * - Captura filtros, paginação e troca de aba
 * - Delega toda lógica HTTP ao Service
 *
 * Estado atual (Parte 3 — Aba Recebidas):
 *   ✅ Header, botão "Nova Conexão" (sem ação — Parte 4)
 *   ✅ Navegação de abas com signal reativo
 *   ✅ Tabela de Negócios Gerados (destinatário, candidato, tipo, status, data)
 *   ✅ Badge laranja para prazoEstourado
 *   ✅ Filter bar com busca + filtros por status e tipo (client-side na página carregada)
 *   ✅ Loading state, empty state, paginação (Geradas e Recebidas)
 *   ✅ Tabela de Negócios Recebidos com botões de ação condicionais por status
 *   🔜 Modal Nova Conexão (Parte 4)
 *   🔜 Modal Atualizar Status (Parte 5)
 *   🔜 Modal Confirmar Exclusão (Parte 6)
 */
@Component({
  selector: 'app-conexoes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conexoes.html',
  styleUrl: './conexoes.css',
})
export class Conexoes implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private conexaoService = inject(ConexaoService);
  private toastService   = inject(ToastService);

  // =========================================================================
  // SIGNAL — ABA ATIVA
  // =========================================================================

  abaAtiva = signal<AbaAtiva>('geradas');

  // =========================================================================
  // SIGNALS — GERADAS: dados e paginação
  // =========================================================================

  conexoesGeradas      = signal<ConexaoGeradaResponseDto[]>([]);
  carregandoGeradas    = signal(false);
  paginaGeradas        = signal(0);
  tamanhoPaginaGeradas = signal(20);
  totalItemsGeradas    = signal(0);
  totalPaginasGeradas  = signal(0);
  temProximaGeradas    = signal(false);
  temAnteriorGeradas   = signal(false);

  // =========================================================================
  // SIGNALS — RECEBIDAS: dados e paginação
  // =========================================================================

  conexoesRecebidas      = signal<ConexaoRecebidaResponseDto[]>([]);
  carregandoRecebidas    = signal(false);
  paginaRecebidas        = signal(0);
  tamanhoPaginaRecebidas = signal(20);
  totalItemsRecebidas    = signal(0);
  totalPaginasRecebidas  = signal(0);
  temProximaRecebidas    = signal(false);
  temAnteriorRecebidas   = signal(false);

  // =========================================================================
  // SIGNALS — GERADAS: filtros
  //
  // Por que filtro client-side em vez de query params no backend?
  // A página já carrega uma janela de até 20 registros. Enviar um novo
  // request a cada keystroke adicionaria latência desnecessária para um
  // conjunto pequeno. Para volumes maiores (>100 itens por página), a
  // decisão deve ser revisitada e os filtros movidos para HttpParams.
  // =========================================================================

  termoBuscaGeradas    = signal('');
  filtroStatusGeradas  = signal<string>('Todos');
  filtroTipoGeradas    = signal<string>('Todos');

  // =========================================================================
  // SIGNALS — RECEBIDAS: filtros
  // =========================================================================

  termoBuscaRecebidas   = signal('');
  filtroStatusRecebidas = signal<string>('Todos');
  filtroTipoRecebidas   = signal<string>('Todos');

  // =========================================================================
  // COMPUTED — GERADAS: lista filtrada
  //
  // Combina os três filtros em cadeia. Recalcula automaticamente sempre que
  // qualquer signal de filtro ou a lista base mudar — sem trigger manual.
  // =========================================================================

  conexoesGeradasFiltradas = computed(() => {
    let lista = this.conexoesGeradas();
    const termo  = this.termoBuscaGeradas().toLowerCase().trim();
    const status = this.filtroStatusGeradas();
    const tipo   = this.filtroTipoGeradas();

    if (termo) {
      lista = lista.filter(c =>
        c.nomeCandidato.toLowerCase().includes(termo) ||
        c.nomeDestinatario.toLowerCase().includes(termo)
      );
    }
    if (status !== 'Todos') {
      lista = lista.filter(c => c.status === status);
    }
    if (tipo !== 'Todos') {
      lista = lista.filter(c => c.tipo === tipo);
    }
    return lista;
  });

  // =========================================================================
  // COMPUTED — RECEBIDAS: lista filtrada
  // =========================================================================

  conexoesRecebidasFiltradas = computed(() => {
    let lista = this.conexoesRecebidas();
    const termo  = this.termoBuscaRecebidas().toLowerCase().trim();
    const status = this.filtroStatusRecebidas();
    const tipo   = this.filtroTipoRecebidas();

    if (termo) {
      lista = lista.filter(c =>
        c.nomeCandidato.toLowerCase().includes(termo) ||
        c.nomeRemetente.toLowerCase().includes(termo)
      );
    }
    if (status !== 'Todos') {
      lista = lista.filter(c => c.status === status);
    }
    if (tipo !== 'Todos') {
      lista = lista.filter(c => c.tipo === tipo);
    }
    return lista;
  });

  // =========================================================================
  // LABELS MAPEADOS
  //
  // Separados em objeto readonly para não duplicar lógica no template.
  // Regra da CLAUDE.md §2.5 (Lei da Imutabilidade Visual): a estrutura do
  // enum não dita a forma de exibição. Os rótulos vivem aqui, não no model.
  // =========================================================================

  readonly LABELS_STATUS: Record<StatusConexao, string> = {
    NOVA:         'Nova',
    EM_ANDAMENTO: 'Em Andamento',
    FECHADA:      'Fechada',
    NAO_FECHADA:  'Não Fechado',
  };

  readonly LABELS_TIPO: Record<TipoConexao, string> = {
    QUENTE: 'Quente',
    MORNA:  'Morna',
    FRIA:   'Fria',
  };

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregarGeradas();
  }

  // =========================================================================
  // NAVEGAÇÃO DE ABAS
  // =========================================================================

  mudarAba(aba: AbaAtiva): void {
    if (this.abaAtiva() === aba) return;
    this.abaAtiva.set(aba);

    // Lazy load: carrega recebidas apenas no primeiro acesso (lista vazia).
    // Evita request desnecessário se o usuário nunca visitar a aba.
    if (aba === 'recebidas' && this.conexoesRecebidas().length === 0) {
      this.carregarRecebidas();
    }
  }

  // =========================================================================
  // GERADAS — carregamento
  // =========================================================================

  carregarGeradas(pagina: number = 0): void {
    this.carregandoGeradas.set(true);

    this.conexaoService
      .listarGeradas(pagina, this.tamanhoPaginaGeradas())
      .subscribe({
        next: (resposta) => {
          this.conexoesGeradas.set(resposta.items);
          this.paginaGeradas.set(resposta.page);
          this.totalItemsGeradas.set(resposta.totalItems);
          this.totalPaginasGeradas.set(resposta.totalPages);
          this.temProximaGeradas.set(resposta.hasNext);
          this.temAnteriorGeradas.set(resposta.hasPrevious);
          this.carregandoGeradas.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.carregandoGeradas.set(false);
          this.toastService.erro('Erro ao carregar negócios gerados. Tente novamente.');
        },
      });
  }

  // =========================================================================
  // GERADAS — paginação
  // =========================================================================

  proximaPaginaGeradas(): void {
    if (this.temProximaGeradas()) {
      this.carregarGeradas(this.paginaGeradas() + 1);
    }
  }

  paginaAnteriorGeradas(): void {
    if (this.temAnteriorGeradas()) {
      this.carregarGeradas(this.paginaGeradas() - 1);
    }
  }

  // =========================================================================
  // GERADAS — filtros
  // =========================================================================

  atualizarBuscaGeradas(valor: string): void {
    this.termoBuscaGeradas.set(valor);
  }

  atualizarFiltroStatusGeradas(valor: string): void {
    this.filtroStatusGeradas.set(valor);
  }

  atualizarFiltroTipoGeradas(valor: string): void {
    this.filtroTipoGeradas.set(valor);
  }

  // =========================================================================
  // RECEBIDAS — carregamento
  // =========================================================================

  carregarRecebidas(pagina: number = 0): void {
    this.carregandoRecebidas.set(true);

    this.conexaoService
      .listarRecebidas(pagina, this.tamanhoPaginaRecebidas())
      .subscribe({
        next: (resposta) => {
          this.conexoesRecebidas.set(resposta.items);
          this.paginaRecebidas.set(resposta.page);
          this.totalItemsRecebidas.set(resposta.totalItems);
          this.totalPaginasRecebidas.set(resposta.totalPages);
          this.temProximaRecebidas.set(resposta.hasNext);
          this.temAnteriorRecebidas.set(resposta.hasPrevious);
          this.carregandoRecebidas.set(false);
        },
        error: (_err: HttpErrorResponse) => {
          this.carregandoRecebidas.set(false);
          this.toastService.erro('Erro ao carregar negócios recebidos. Tente novamente.');
        },
      });
  }

  // =========================================================================
  // RECEBIDAS — paginação
  // =========================================================================

  proximaPaginaRecebidas(): void {
    if (this.temProximaRecebidas()) {
      this.carregarRecebidas(this.paginaRecebidas() + 1);
    }
  }

  paginaAnteriorRecebidas(): void {
    if (this.temAnteriorRecebidas()) {
      this.carregarRecebidas(this.paginaRecebidas() - 1);
    }
  }

  // =========================================================================
  // RECEBIDAS — filtros
  // =========================================================================

  atualizarBuscaRecebidas(valor: string): void {
    this.termoBuscaRecebidas.set(valor);
  }

  atualizarFiltroStatusRecebidas(valor: string): void {
    this.filtroStatusRecebidas.set(valor);
  }

  atualizarFiltroTipoRecebidas(valor: string): void {
    this.filtroTipoRecebidas.set(valor);
  }

  // =========================================================================
  // RECEBIDAS — ações de status (placeholder — Parte 5 implementa os modais)
  //
  // Por que placeholder e não modal já? Os botões precisam existir no template
  // para validar a UX, mas a lógica de modal (formulário de valor, motivo) só
  // é construída na Parte 5. O console.warn avisa durante desenvolvimento
  // que a ação ainda não está conectada.
  // =========================================================================

  abrirModalAtualizarStatus(conexao: ConexaoRecebidaResponseDto, novoStatus: StatusConexao): void {
    console.warn('[Parte 5] Modal atualizar status — pendente de implementação', {
      idConexao: conexao.idConexao,
      statusAtual: conexao.status,
      novoStatus,
    });
  }

  // =========================================================================
  // HELPERS VISUAIS
  //
  // Retornam classes CSS para chips e badges — a escolha da aparência
  // vive aqui, não no template (CLAUDE.md §2.2: componente só exibe).
  // =========================================================================

  classeChipStatus(status: StatusConexao): string {
    const mapa: Record<StatusConexao, string> = {
      NOVA:         'status-chip status-nova',
      EM_ANDAMENTO: 'status-chip status-andamento',
      FECHADA:      'status-chip status-fechada',
      NAO_FECHADA:  'status-chip status-nao-fechada',
    };
    return mapa[status];
  }

  classeChipTipo(tipo: TipoConexao): string {
    const mapa: Record<TipoConexao, string> = {
      QUENTE: 'status-chip badge-quente',
      MORNA:  'status-chip badge-morna',
      FRIA:   'status-chip badge-fria',
    };
    return mapa[tipo];
  }

  /**
   * formatarData(iso)
   *
   * Converte um LocalDateTime ISO 8601 vindo do backend para
   * exibição no formato brasileiro DD/MM/AAAA.
   *
   * O backend retorna '2026-05-02T10:30:00' — sem timezone.
   * Usar new Date() sem sufixo interpreta como local, o que é
   * desejado aqui: a data da reunião é no fuso do usuário.
   */
  formatarData(iso: string): string {
    if (!iso) return '—';
    const data = new Date(iso);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * iniciaisNome(nome)
   *
   * Gera até 2 iniciais para o avatar da tabela.
   * Ex: "Maria Souza" → "MS", "João" → "J"
   */
  iniciaisNome(nome: string): string {
    if (!nome) return '?';
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * formatarMoeda(valor)
   *
   * Formata um valor numérico como moeda brasileira.
   * Usado na coluna "Valor" dos negócios recebidos.
   * Ex: 1500 → "R$ 1.500,00", null → "—"
   */
  formatarMoeda(valor: number | null): string {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
