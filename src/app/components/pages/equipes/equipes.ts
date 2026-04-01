import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EquipeService } from '../../../services/equipe.service';
import { EquipeResponseDto, PaginacaoResponseDto } from '../../../models/equipe.model';

// Valores possíveis de status espelhando o campo statusEquipe da entidade Equipe no backend
export type StatusEquipe = 'Ativa' | 'Em formação' | 'Inativa';
export type ModeloReuniao = 'Presencial' | 'Online' | 'Híbrido';

// Modelo local: estende EquipeResponseDto com campos adicionais do frontend
export type Equipe = EquipeResponseDto & {
  membros: number;              // TODO: implementar endpoint para obter número de associados ativos
  minimoLancamento: number;     // Constante: 15 (conforme PRD)
};

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipes.html',
  styleUrl: './equipes.css',
})
export class Equipes implements OnInit {
  private equipesService: EquipeService;

  // Estados dos filtros — qualquer alteração recalcula automaticamente equipesFiltradas
  termoBusca = signal('');
  filtroStatus = signal<string>('Todos');
  filtroModelo = signal<string>('Todos');

  // Signal para equipes carregadas da API (com dados mockados como fallback)
  equipes = signal<Equipe[]>([]);

  // Constante: mínimo de associados para lançamento
  readonly MINIMO_LANCAMENTO = 15;

  constructor(equipesService: EquipeService) {
    this.equipesService = equipesService;
  }

  ngOnInit(): void {
    this.carregarEquipes();
  }

  /**
   * Carrega as equipes da API
   */
  private carregarEquipes(): void {
    this.equipesService.listarEquipes(0, 100).subscribe({
      next: (response) => {
        // Mapear EquipeResponseDto para Equipe (adicionar membros e minimoLancamento)
        const equipesComCamposAdicionais: Equipe[] = response.conteudo.map((equipe) => ({
          ...equipe,
          membros: 0, // TODO: implementar endpoint para obter número de associados ativos
          minimoLancamento: this.MINIMO_LANCAMENTO,
        }));
        this.equipes.set(equipesComCamposAdicionais);
      },
      error: (erro) => {
        console.error('Erro ao carregar equipes:', erro);
        // Manter array vazio ou pode carregar dados mockados como fallback
        // this.equipes.set([/* dados mockados */]);
      },
    });
  }

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

  classeStatus(status: string): string {
    if (status === 'Ativa')        return 'status-chip status-ativa';
    if (status === 'Em formação')  return 'status-chip status-formacao';
    return 'status-chip status-inativa';
  }

  iconeModelo(modelo: string): string {
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
