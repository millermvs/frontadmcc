import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

// Valores possíveis de status espelhando o campo statusEquipe da entidade Equipe no backend
export type StatusEquipe = 'Ativa' | 'Em formação' | 'Inativa';
export type ModeloReuniao = 'Presencial' | 'Online' | 'Híbrido';

// Espelho do EquipeResponseDto — será substituído pelo tipo gerado pelo serviço HTTP quando integrado ao backend
export type Equipe = {
  idEquipe: number;
  nomeEquipe: string;
  statusEquipe: StatusEquipe;
  diaReuniao: string;
  horarioReuniao: string;
  modeloReuniao: ModeloReuniao;
  linkReuniaoOnline: string | null;
  dataInicioFormacao: string;       // ISO 8601 (yyyy-MM-dd)
  dataPrevisaoLancamento: string;
  dataEfetivaLancamento: string | null; // null enquanto equipe ainda não foi lançada
  membros: number;
  minimoLancamento: number;
};

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipes.html',
  styleUrl: './equipes.css',
})
export class Equipes {

  // Estados dos filtros — qualquer alteração recalcula automaticamente equipesFiltradas
  termoBusca = signal('');
  filtroStatus = signal<string>('Todos');
  filtroModelo = signal<string>('Todos');

  // TODO: substituir por chamada ao EquipeService (GET /api/v1/equipes) quando integrado
  equipes = signal<Equipe[]>([
    {
      idEquipe: 1,
      nomeEquipe: 'C+C Impulso',
      statusEquipe: 'Ativa',
      diaReuniao: 'Quarta-feira',
      horarioReuniao: '07:00',
      modeloReuniao: 'Presencial',
      linkReuniaoOnline: null,
      dataInicioFormacao: '2023-03-10',
      dataPrevisaoLancamento: '2023-06-10',
      dataEfetivaLancamento: '2023-06-14',
      membros: 22,
      minimoLancamento: 15,
    },
    {
      idEquipe: 2,
      nomeEquipe: 'C+C Conexão',
      statusEquipe: 'Ativa',
      diaReuniao: 'Quinta-feira',
      horarioReuniao: '19:30',
      modeloReuniao: 'Presencial',
      linkReuniaoOnline: null,
      dataInicioFormacao: '2023-07-01',
      dataPrevisaoLancamento: '2023-10-01',
      dataEfetivaLancamento: '2023-10-05',
      membros: 18,
      minimoLancamento: 15,
    },
    {
      idEquipe: 3,
      nomeEquipe: 'C+C Fênix',
      statusEquipe: 'Em formação',
      diaReuniao: 'Terça-feira',
      horarioReuniao: '07:00',
      modeloReuniao: 'Online',
      linkReuniaoOnline: 'https://zoom.us/j/123456',
      dataInicioFormacao: '2024-01-15',
      dataPrevisaoLancamento: '2024-04-15',
      dataEfetivaLancamento: null,
      membros: 12,
      minimoLancamento: 15,
    },
    {
      idEquipe: 4,
      nomeEquipe: 'C+C Horizonte',
      statusEquipe: 'Em formação',
      diaReuniao: 'Segunda-feira',
      horarioReuniao: '19:00',
      modeloReuniao: 'Híbrido',
      linkReuniaoOnline: 'https://meet.google.com/abc',
      dataInicioFormacao: '2024-03-01',
      dataPrevisaoLancamento: '2024-06-01',
      dataEfetivaLancamento: null,
      membros: 9,
      minimoLancamento: 15,
    },
    {
      idEquipe: 5,
      nomeEquipe: 'C+C Vanguarda',
      statusEquipe: 'Em formação',
      diaReuniao: 'Sexta-feira',
      horarioReuniao: '08:00',
      modeloReuniao: 'Presencial',
      linkReuniaoOnline: null,
      dataInicioFormacao: '2024-05-10',
      dataPrevisaoLancamento: '2024-08-10',
      dataEfetivaLancamento: null,
      membros: 6,
      minimoLancamento: 15,
    },
    {
      idEquipe: 6,
      nomeEquipe: 'C+C Pioneiros',
      statusEquipe: 'Inativa',
      diaReuniao: 'Terça-feira',
      horarioReuniao: '19:30',
      modeloReuniao: 'Presencial',
      linkReuniaoOnline: null,
      dataInicioFormacao: '2022-01-10',
      dataPrevisaoLancamento: '2022-04-10',
      dataEfetivaLancamento: '2022-04-20',
      membros: 0,
      minimoLancamento: 15,
    },
  ]);

  // Contadores derivados — recalculados automaticamente sempre que o signal equipes mudar
  totalAtivas    = computed(() => this.equipes().filter(e => e.statusEquipe === 'Ativa').length);
  totalEmFormacao = computed(() => this.equipes().filter(e => e.statusEquipe === 'Em formação').length);
  totalInativas  = computed(() => this.equipes().filter(e => e.statusEquipe === 'Inativa').length);

  // Aplica os três filtros combinados; quando termoBusca está vazio (!termo), ignora o filtro de nome
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

  // Limita o retorno a 100% para não ultrapassar a barra de progresso em equipes com mais membros que o mínimo
  percentualFormacao(equipe: Equipe): number {
    const p = (equipe.membros / equipe.minimoLancamento) * 100;
    return Math.min(p, 100);
  }

  // Converte ISO (yyyy-MM-dd) para o formato brasileiro (dd/MM/yyyy); retorna traço se a data for nula
  formatarData(data: string | null): string {
    if (!data) return '—';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  classeStatus(status: StatusEquipe): string {
    if (status === 'Ativa')        return 'status-chip status-ativa';
    if (status === 'Em formação')  return 'status-chip status-formacao';
    return 'status-chip status-inativa';
  }

  iconeModelo(modelo: ModeloReuniao): string {
    if (modelo === 'Online')  return 'bi-camera-video-fill';
    if (modelo === 'Híbrido') return 'bi-laptop-fill';
    return 'bi-geo-alt-fill';
  }

  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
  }

  atualizarFiltroStatus(valor: string): void {
    this.filtroStatus.set(valor);
  }

  atualizarFiltroModelo(valor: string): void {
    this.filtroModelo.set(valor);
  }

  // TODO: abrir modal ou navegar para rota de edição quando o serviço estiver integrado
  editarEquipe(equipe: Equipe): void {
    console.log('Editar equipe:', equipe.nomeEquipe);
  }

  // TODO: chamar EquipeService.inativarEquipe() e atualizar o signal local após confirmação
  inativarEquipe(equipe: Equipe): void {
    console.log('Inativar equipe:', equipe.nomeEquipe);
  }
}
