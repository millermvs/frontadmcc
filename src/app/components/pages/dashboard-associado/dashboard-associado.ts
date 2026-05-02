import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/auth';
import { AssociadoService } from '../../../services/associado.service';
import { PerfilAssociadoService } from '../../../services/perfil-associado.service';
import { AssociadoResponseDto, LABELS_STATUS_ASSOCIADO } from '../../../models/associado.model';
import { PerfilAssociadoResponseDto } from '../../../models/perfil-associado.model';

// ============================================================
// DashboardAssociado
// ============================================================
// Painel pessoal do associado — exibe APENAS os dados e
// indicadores relevantes para o associado logado.
//
// Dados reais (carregados via HTTP):
//   - AssociadoService.buscarAssociadoPorId  → equipe, status, ingresso, vencimento
//   - PerfilAssociadoService.buscarPorAssociado → cargo, empresa (pode ser 404)
//
// Dados mock (TODO: substituir quando os sprints estiverem prontos):
//   - indicadoresSemana  → Sprint 9 (GET /indicadores/associado/{id}/semana-atual)
//   - conexoesRecebidas  → Sprint 7 (GET /conexoes/recebidas/associado/{id})
//   - NR (negócios)      → Sprint 7 (GET /conexoes/nr/associado/{id})
// ============================================================

type IndicadorSemanal = {
  nome: string;
  icone: string;
  valor: number;
  pontos: number;
  classeIcone: string;
  rota: string;
  labelValor: string;
};

type ConexaoRecebida = {
  quemEnviou: string;
  contato: string;
  empresa: string;
  tipo: 'Quente' | 'Morna' | 'Fria';
  status: 'Nova' | 'Em andamento' | 'Fechada' | 'Não fechada';
};

type AtalhoRapido = {
  nome: string;
  icone: string;
  descricao: string;
  rota: string;
  classeIcone: string;
};

@Component({
  selector: 'app-dashboard-associado',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-associado.html',
  styleUrl: './dashboard-associado.css',
})
export class DashboardAssociado implements OnInit {

  // ── Injeções ──────────────────────────────────────────────
  private authService      = inject(AuthService);
  private associadoService = inject(AssociadoService);
  private perfilService    = inject(PerfilAssociadoService);

  // ── Estado ────────────────────────────────────────────────
  carregando = signal(true);
  associado  = signal<AssociadoResponseDto | null>(null);
  perfil     = signal<PerfilAssociadoResponseDto | null>(null);

  // ── Computed — identidade ─────────────────────────────────
  primeiroNome = computed(() => {
    const usuario = this.authService.usuario();
    if (!usuario) return '';
    return usuario.nome.split(' ')[0];
  });

  labelStatus = computed(() => {
    const a = this.associado();
    if (!a) return '';
    return LABELS_STATUS_ASSOCIADO[a.statusAssociado] ?? a.statusAssociado;
  });

  classeStatus = computed(() => {
    const a = this.associado();
    if (!a) return 'status-chip';
    const mapa: Record<string, string> = {
      ATIVO:                    'status-chip status-ativa',
      PREATIVO:                 'status-chip status-pre-ativo',
      INATIVO_PAUSA_PROGRAMADA: 'status-chip status-formacao',
    };
    return mapa[a.statusAssociado] ?? 'status-chip status-inativa';
  });

  nomeEmpresa = computed(() => this.perfil()?.nomeEmpresa ?? '—');
  nomeCargoAtual = computed(() => this.perfil()?.nomeCargoAtual ?? null);

  // ── Mock: Indicadores semanais ────────────────────────────
  // TODO Sprint 9: substituir por GET /api/v1/indicadores/associado/{id}/semana-atual
  indicadoresSemana = signal<IndicadorSemanal[]>([
    {
      nome: 'Reuniões C+C',
      icone: 'bi-calendar-check-fill',
      valor: 3,
      pontos: 15,
      classeIcone: 'kpi-icon-ativo',
      rota: '/pages/reunioes',
      labelValor: 'reuniões',
    },
    {
      nome: 'Conexões Geradas',
      icone: 'bi-share-fill',
      valor: 5,
      pontos: 0,
      classeIcone: 'kpi-icon-total',
      rota: '/pages/conexoes',
      labelValor: 'conexões',
    },
    {
      nome: 'Parcerias',
      icone: 'bi-link-45deg',
      valor: 2,
      pontos: 10,
      classeIcone: 'kpi-icon-pendente',
      rota: '/pages/parcerias',
      labelValor: 'parcerias',
    },
    {
      nome: 'Visitantes',
      icone: 'bi-person-plus-fill',
      valor: 1,
      pontos: 0,
      classeIcone: 'kpi-icon-inativo',
      rota: '/pages/visitantes',
      labelValor: 'visitantes',
    },
  ]);

  totalPontosSemana = computed(() =>
    this.indicadoresSemana().reduce((acc, i) => acc + i.pontos, 0)
  );

  // ── Mock: NR (negócios gerados/recebidos) ─────────────────
  // TODO Sprint 7: substituir por GET /api/v1/conexoes/nr/associado/{id}
  nrGerado   = signal(15000);
  nrRecebido = signal(28500);

  // ── Mock: Conexões recebidas ──────────────────────────────
  // TODO Sprint 7: substituir por GET /api/v1/conexoes/recebidas/associado/{id}
  conexoesRecebidas = signal<ConexaoRecebida[]>([
    { quemEnviou: 'Ana Paula', contato: 'Juliana Mendes', empresa: 'Studio Vitta', tipo: 'Quente', status: 'Nova' },
    { quemEnviou: 'Ricardo Alves', contato: 'Paulo Ferreira', empresa: 'PDX Engenharia', tipo: 'Morna', status: 'Em andamento' },
    { quemEnviou: 'Carlos Nunes', contato: 'Marcelo Costa', empresa: 'Empresa Alfa', tipo: 'Quente', status: 'Fechada' },
  ]);

  // ── Atalhos rápidos (estático) ────────────────────────────
  atalhos: AtalhoRapido[] = [
    { nome: 'Reuniões C+C', icone: 'bi-calendar-event-fill', descricao: 'Agendar e validar reuniões bilaterais', rota: '/pages/reunioes', classeIcone: 'atalho-verde' },
    { nome: 'Conexões', icone: 'bi-share-fill', descricao: 'Indicar negócios para outros associados', rota: '/pages/conexoes', classeIcone: 'atalho-amarelo' },
    { nome: 'Parcerias', icone: 'bi-link-45deg', descricao: 'Registrar parcerias formadas', rota: '/pages/parcerias', classeIcone: 'atalho-azul' },
    { nome: 'Visitantes', icone: 'bi-person-plus-fill', descricao: 'Cadastrar visitantes para sua reunião', rota: '/pages/visitantes', classeIcone: 'atalho-roxo' },
    { nome: 'Perfil C+C', icone: 'bi-person-vcard-fill', descricao: 'Manter seu perfil atualizado na rede', rota: '/pages/perfil-cc', classeIcone: 'atalho-cinza' },
  ];

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    const idAssociado = this.authService.usuario()?.idAssociado;

    if (!idAssociado) {
      this.carregando.set(false);
      return;
    }

    // Carrega dados do associado e do perfil em paralelo.
    // O perfil usa catchError porque pode retornar 404 (perfil ainda não cadastrado).
    forkJoin({
      associado: this.associadoService.buscarAssociadoPorId(idAssociado),
      perfil: this.perfilService.buscarPorAssociado(idAssociado).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: ({ associado, perfil }) => {
        this.associado.set(associado);
        this.perfil.set(perfil);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
      },
    });
  }

  // ── Helpers de template ────────────────────────────────────
  formatarData(data: string | null): string {
    if (!data) return '—';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  textoMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  classeTipoConexao(tipo: string): string {
    if (tipo === 'Quente') return 'badge badge-quente';
    if (tipo === 'Morna')  return 'badge badge-morna';
    return 'badge badge-fria';
  }

  classeStatusConexao(status: string): string {
    if (status === 'Nova')         return 'status-chip status-nova';
    if (status === 'Em andamento') return 'status-chip status-andamento';
    if (status === 'Fechada')      return 'status-chip status-fechada';
    return 'status-chip status-nao-fechada';
  }
}
