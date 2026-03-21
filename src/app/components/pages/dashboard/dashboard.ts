import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type CardResumo = {
  titulo: string;
  valor: string;
  subtitulo: string;
  icone: string;
  rota: string;
  classeIcone: string;
};

type AgendaItem = {
  equipe: string;
  dia: string;
  horario: string;
  local: string;
  status: 'Hoje' | 'Próxima' | 'Online';
};

type ConexaoItem = {
  associadoOrigem: string;
  associadoDestino: string;
  contato: string;
  tipo: 'Quente' | 'Morna' | 'Fria';
  status: 'Nova' | 'Em andamento' | 'Fechada' | 'Não fechada';
};

type EquipeResumo = {
  nome: string;
  membros: number;
  minimoLancamento: number;
  status: 'Em formação' | 'Ativa';
};

type RankingItem = {
  nome: string;
  equipe: string;
  total: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  nomeRede = signal('C+C');
  periodoAtual = signal('Resumo da semana');

  totalEquipes = signal(8);
  totalAssociados = signal(126);
  totalConexoesSemana = signal(34);
  totalNegociosGerados = signal(48750);
  totalNegociosRecebidos = signal(52800);
  totalVisitantesMes = signal(19);

  equipes = signal<EquipeResumo[]>([
    { nome: 'C+C Fênix', membros: 12, minimoLancamento: 15, status: 'Em formação' },
    { nome: 'C+C Impulso', membros: 15, minimoLancamento: 15, status: 'Ativa' },
    { nome: 'C+C Horizonte', membros: 9, minimoLancamento: 15, status: 'Em formação' },
    { nome: 'C+C Conexão', membros: 18, minimoLancamento: 15, status: 'Ativa' },
  ]);

  agendaSemana = signal<AgendaItem[]>([
    { equipe: 'C+C Fênix', dia: 'Terça-feira', horario: '07:00', local: 'Zoom', status: 'Online' },
    { equipe: 'C+C Impulso', dia: 'Quarta-feira', horario: '19:30', local: 'Auditório Central', status: 'Próxima' },
    { equipe: 'C+C Conexão', dia: 'Hoje', horario: '20:00', local: 'Hotel Plaza', status: 'Hoje' },
  ]);

  ultimasConexoes = signal<ConexaoItem[]>([
    { associadoOrigem: 'João Martins', associadoDestino: 'Carlos Nunes', contato: 'Marcelo • Empresa Alfa', tipo: 'Quente', status: 'Em andamento' },
    { associadoOrigem: 'Ana Paula', associadoDestino: 'Fernanda Lima', contato: 'Juliana • Studio Vitta', tipo: 'Morna', status: 'Nova' },
    { associadoOrigem: 'Ricardo Alves', associadoDestino: 'Michele Souza', contato: 'Paulo • PDX Engenharia', tipo: 'Quente', status: 'Fechada' },
    { associadoOrigem: 'Bruno Costa', associadoDestino: 'Lucas Prado', contato: 'Márcia • Clínica Bem Viver', tipo: 'Fria', status: 'Não fechada' },
  ]);

  rankingGeradores = signal<RankingItem[]>([
    { nome: 'Carlos Nunes', equipe: 'C+C Impulso', total: 18 },
    { nome: 'Ana Paula', equipe: 'C+C Conexão', total: 16 },
    { nome: 'Ricardo Alves', equipe: 'C+C Impulso', total: 14 },
    { nome: 'Fernanda Lima', equipe: 'C+C Fênix', total: 11 },
  ]);

  cardsResumo = computed<CardResumo[]>(() => [
    {
      titulo: 'Equipes',
      valor: String(this.totalEquipes()),
      subtitulo: 'Total de equipes na rede',
      icone: 'bi-people-fill',
      rota: '/pages/equipes',
      classeIcone: 'icon-soft-success',
    },
    {
      titulo: 'Associados',
      valor: String(this.totalAssociados()),
      subtitulo: 'Associados cadastrados',
      icone: 'bi-person-badge-fill',
      rota: '/pages/associados',
      classeIcone: 'icon-soft-primary',
    },
    {
      titulo: 'Conexões',
      valor: String(this.totalConexoesSemana()),
      subtitulo: 'Conexões geradas na semana',
      icone: 'bi-share-fill',
      rota: '/pages/conexoes',
      classeIcone: 'icon-soft-warning',
    },
    {
      titulo: 'Visitantes',
      valor: String(this.totalVisitantesMes()),
      subtitulo: 'Visitantes registrados no mês',
      icone: 'bi-person-plus-fill',
      rota: '/pages/visitantes',
      classeIcone: 'icon-soft-info',
    },
  ]);

  percentualFormacao(equipe: EquipeResumo): number {
    const percentual = (equipe.membros / equipe.minimoLancamento) * 100;
    return percentual > 100 ? 100 : percentual;
  }

  textoMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  classeTipoConexao(tipo: string): string {
    if (tipo === 'Quente') return 'badge badge-quente';
    if (tipo === 'Morna') return 'badge badge-morna';
    return 'badge badge-fria';
  }

  classeStatusConexao(status: string): string {
    if (status === 'Nova') return 'status-chip status-nova';
    if (status === 'Em andamento') return 'status-chip status-andamento';
    if (status === 'Fechada') return 'status-chip status-fechada';
    return 'status-chip status-nao-fechada';
  }

  classeStatusAgenda(status: string): string {
    if (status === 'Hoje') return 'agenda-chip agenda-hoje';
    if (status === 'Online') return 'agenda-chip agenda-online';
    return 'agenda-chip agenda-proxima';
  }

  classeStatusEquipe(status: string): string {
    return status === 'Ativa'
      ? 'status-chip status-ativa'
      : 'status-chip status-formacao';
  }
}