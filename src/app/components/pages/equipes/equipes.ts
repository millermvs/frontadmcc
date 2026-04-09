import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EquipeService } from '../../../services/equipe.service';
import {
  EquipeResponseDto,
  EquipeRequestDto,
  LocalPresencialSemIdDto,
  LABELS_DIA,
  LABELS_MODELO,
  LABELS_HORARIO,
} from '../../../models/equipe.model';

// Tipo local: estende EquipeResponseDto com campos adicionais do frontend
export type Equipe = EquipeResponseDto & {
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
 *   1. Usuário preenche form (novaEquipe + novoLocalPresencial)
 *   2. salvarNovaEquipe() chama EquipeService.cadastrarEquipe()
 *   3. Service encadeia os dois endpoints internamente (transparente aqui)
 *   4. Sucesso: fecha modal + reseta form + recarrega lista
 *   5. Erro: exibe mensagem dentro da modal (não fecha)
 */
@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipes.html',
  styleUrl: './equipes.css',
})
export class Equipes implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private equipesService = inject(EquipeService);

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca     = signal('');
  filtroStatus   = signal<string>('Todos');
  filtroModelo   = signal<string>('Todos');
  equipes        = signal<Equipe[]>([]);
  carregandoLista = signal(false);

  // =========================================================================
  // SIGNALS — MODAL
  // =========================================================================

  carregandoModal  = signal(false);
  erroModalEquipe  = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend (400 com objeto errors).
   * Chave = nome do campo Java (ex: 'nomeEquipe'), valor = mensagem.
   * Exibidos inline embaixo de cada input no template.
   */
  errosValidacao   = signal<Record<string, string>>({});

  listaAssociados  = signal<Array<{ idAssociado: number; nomeCompleto: string }>>([]);

  // =========================================================================
  // OBJETOS DO FORMULÁRIO
  // =========================================================================

  /**
   * novaEquipe: dados enviados ao primeiro endpoint (POST /equipes/cadastrar)
   * Inicializado vazio e resetado após sucesso.
   */
  novaEquipe: EquipeRequestDto = this.criarEquipeVazia();

  /**
   * novoLocalPresencial: dados enviados ao segundo endpoint (POST /locais-presenciais)
   * Só é usado quando novaEquipe.modeloReuniao !== 'ONLINE'.
   * O idEquipe é preenchido pelo Service com o retorno do primeiro POST.
   */
  novoLocalPresencial: LocalPresencialSemIdDto = this.criarLocalVazio();

  // =========================================================================
  // CONSTANTES
  // =========================================================================

  readonly MINIMO_LANCAMENTO = 15;

  // Labels para exibição na tabela (backend → usuário)
  readonly LABELS_DIA    = LABELS_DIA;
  readonly LABELS_MODELO = LABELS_MODELO;
  readonly LABELS_HORARIO = LABELS_HORARIO;

  // =========================================================================
  // COMPUTED — CONTADORES (KPI cards)
  // =========================================================================

  totalAtivas      = computed(() => this.equipes().filter(e => e.statusEquipe === 'Ativa').length);
  totalEmFormacao  = computed(() => this.equipes().filter(e => e.statusEquipe === 'Em formação').length);
  totalInativas    = computed(() => this.equipes().filter(e => e.statusEquipe === 'Inativa').length);

  // =========================================================================
  // COMPUTED — FILTROS
  // =========================================================================

  equipesFiltradas = computed(() => {
    const termo  = this.termoBusca().toLowerCase().trim();
    const status = this.filtroStatus();
    const modelo = this.filtroModelo();

    return this.equipes().filter(e => {
      const baterBusca   = !termo || e.nomeEquipe.toLowerCase().includes(termo);
      const baterStatus  = status === 'Todos' || e.statusEquipe === status;
      const baterModelo  = modelo === 'Todos' || e.modeloReuniao === modelo;
      return baterBusca && baterStatus && baterModelo;
    });
  });

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
  // MÉTODOS PÚBLICOS — MODAL
  // =========================================================================

  /**
   * salvarNovaEquipe()
   *
   * Chamado pelo botão "Salvar Equipe" na modal.
   *
   * Decide qual local passar ao service:
   *   - ONLINE → null (service não chama o segundo endpoint)
   *   - PRESENCIAL / HIBRIDO → novoLocalPresencial (service encadeia os dois POSTs)
   */
  salvarNovaEquipe(): void {
    this.carregandoModal.set(true);
    this.erroModalEquipe.set(null);
    this.errosValidacao.set({});

    const local = this.novaEquipe.modeloReuniao !== 'ONLINE'
      ? this.novoLocalPresencial
      : null;

    this.equipesService.cadastrarEquipe(this.novaEquipe, local).subscribe({
      next: () => {
        // Fechar modal via botão oculto com data-bs-dismiss (sem import do Bootstrap)
        document.getElementById('btnFecharModalEquipe')?.click();

        // Resetar formulário e erros para próxima abertura
        this.novaEquipe = this.criarEquipeVazia();
        this.novoLocalPresencial = this.criarLocalVazio();
        this.errosValidacao.set({});

        // Recarregar lista
        this.carregarEquipes();

        // TODO: toastService.sucesso('Equipe cadastrada com sucesso!');
      },

      error: (err) => {
        // 400 com erros por campo → exibe inline em cada input
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacao.set(err.error.errors);
          this.erroModalEquipe.set('Corrija os campos destacados.');
        } else {
          // Outros erros (409, 422, 500, rede) → mensagem no rodapé
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
  // MÉTODOS PÚBLICOS — TABELA
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
    if (status === 'Ativa') return 'status-chip status-ativa';
    if (status === 'Em formação') return 'status-chip status-formacao';
    return 'status-chip status-inativa';
  }

  iconeModelo(modelo: string): string {
    if (modelo === 'ONLINE')    return 'bi-camera-video-fill';
    if (modelo === 'HIBRIDO')   return 'bi-laptop-fill';
    return 'bi-geo-alt-fill'; // PRESENCIAL
  }

  // TODO: abrir modal de edição quando Sprint 2 estiver disponível
  editarEquipe(equipe: Equipe): void {
    console.log('Editar equipe:', equipe.nomeEquipe);
  }

  // TODO: chamar EquipeService.inativarEquipe() após confirmar com o usuário
  inativarEquipe(equipe: Equipe): void {
    console.log('Inativar equipe:', equipe.nomeEquipe);
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
      error: (erro) => {
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
  private extrairMensagemErro(err: any): string {
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

  private criarEquipeVazia(): EquipeRequestDto {
    return {
      nomeEquipe: '',
      dataInicioFormacao: null,    // backend defaulta para hoje quando null
      dataEfetivaLancamento: null,
      diaReuniao: null,            // null → Jackson aceita, @NotNull do backend valida
      horarioReuniao: null,        // null → Jackson aceita, @NotNull do backend valida
      modeloReuniao: null,         // null → Jackson aceita, @NotNull do backend valida
      linkReuniaoOnline: null,
      statusEquipe: 'Em formação',
    };
  }

  private criarLocalVazio(): LocalPresencialSemIdDto {
    return {
      rua: '',
      numero: '',
      complemento: null,
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
    };
  }
}