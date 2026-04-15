import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth';

// ============================================================
// Navbar (Sidebar)
// ============================================================
// Componente compartilhado que exibe o menu lateral da aplicação.
//
// Responsabilidades:
//   - Exibir os links de navegação (menu)
//   - Mostrar nome e role do usuário logado
//   - Oferecer a opção de logout
//   - Expandir/colapsar a sidebar
//
// Analogia backend: é como um "header de segurança" que mostra
// quem está logado e permite encerrar a sessão, mas no visual.
//
// O AuthService é injetado para acessar os dados do usuário
// via signals — quando o login/logout acontece, o nome e a
// visibilidade do menu atualizam automaticamente (reatividade).
// ============================================================

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {

  // ── Injeções ──────────────────────────────────────────────
  // inject() é o equivalente Angular do @Autowired do Spring.
  // Diferença: aqui usamos como função, não como decorator.
  private authService = inject(AuthService);

  // ── Signals de estado local ───────────────────────────────
  sidebarExpanded = signal(false);

  // ── Signals derivados (computed) ──────────────────────────
  // computed() recalcula automaticamente quando o signal de
  // origem muda. Analogia: é como um @Transient que depende
  // de outros campos — sempre reflete o valor atual.

  /** Primeiro nome do usuário (para exibir na sidebar) */
  nomeUsuario = computed(() => {
    const usuario = this.authService.usuario();
    if (!usuario) return '';
    // Pega só o primeiro nome para caber na sidebar
    return usuario.nome.split(' ')[0];
  });

  /** true quando o usuário logado é ADM_CC — controla itens exclusivos no menu */
  isAdm = computed(() => this.authService.temPermissao('ADM_CC'));

  /** Perfil formatado para exibição (ex: 'ADM C+C') */
  roleUsuario = computed(() => {
    const usuario = this.authService.usuario();
    if (!usuario) return '';
    // O backend envia perfil: 'ADM_CC' | 'DIRETOR' | 'ASSOCIADO'
    const mapa: Record<string, string> = {
      'ADM_CC':    'ADM C+C',
      'DIRETOR':   'Diretor',
      'ASSOCIADO': 'Associado',
    };
    return mapa[usuario.perfil] ?? usuario.perfil;
  });

  // ── Métodos ───────────────────────────────────────────────

  toggleSidebar(): void {
    this.sidebarExpanded.update(valorAtual => !valorAtual);
  }

  /** Encerra a sessão do usuário */
  logout(): void {
    // Delega tudo ao AuthService (limpar storage, redirecionar)
    // O componente NÃO faz lógica de negócio — apenas delega.
    this.authService.logout();
  }
}