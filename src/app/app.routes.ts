import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

// ============================================================
// Rotas da Aplicação
// ============================================================
//
// Analogia com o SecurityConfig do backend:
//
//   Backend (SecurityConfig):
//     .requestMatchers("/auth/login").permitAll()     ← rota pública
//     .anyRequest().authenticated()                    ← authGuard protege tudo
//
//   Frontend (este arquivo):
//     { path: 'login' }                               ← sem guard (pública)
//     { path: 'pages', canActivate: [authGuard] }     ← protegida
//
// ── Lazy Loading (loadComponent) ───────────────────────────
// Em vez de importar os componentes no topo do arquivo, usamos
// loadComponent que carrega o componente SÓ quando o usuário
// navega para aquela rota. Isso melhora o tempo de carregamento
// inicial da aplicação.
//
// Analogia: é como no backend usar @Lazy nos @Bean — só instancia
// quando realmente precisa.
//
// ── Rotas filhas (children) ────────────────────────────────
// As rotas dentro de 'pages' são "filhas" — herdam o guard
// do pai. Se o authGuard bloqueia 'pages', TODAS as filhas
// também ficam bloqueadas. Não precisa repetir o guard em cada uma.
//
// Analogia: é como no SecurityConfig usar:
//   .requestMatchers("/api/**").authenticated()
// Todas as rotas que começam com /api ficam protegidas.
// ============================================================

export const routes: Routes = [
  // ── Rota pública: Login ─────────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/login/login').then((m) => m.Login),
  },

  // ── Rotas protegidas: Pages ─────────────────────────────
  // O Layout é carregado como "wrapper" das rotas filhas.
  // Ele contém a navbar + <router-outlet> onde as páginas aparecem.
  // Isso garante que APENAS as rotas dentro de /pages veem a navbar.
  // A rota /login fica fora — renderiza direto no app.html (sem navbar).
  //
  // Analogia: é como no SecurityConfig você ter dois FilterChains:
  //   um para /auth/** (sem filtros de autenticação)
  //   outro para /api/** (com todos os filtros)
  // Aqui o "filtro visual" é o Layout (com navbar).
  {
    path: 'pages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/shared/layout/layout').then((m) => m.Layout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'equipes',
        loadComponent: () =>
          import('./components/pages/equipes/equipes').then((m) => m.Equipes),
      },
      {
        path: 'clusters',
        loadComponent: () =>
          import('./components/pages/clusters/clusters').then((m) => m.Clusters),
      },
      {
        path: 'cargos-lideranca',
        loadComponent: () =>
          import('./components/pages/cargos-lideranca/cargos-lideranca').then((m) => m.CargosLideranca),
      },
    ],
  },

  // ── Redirects ───────────────────────────────────────────
  { path: '', pathMatch: 'full', redirectTo: 'pages/dashboard' },
  { path: '**', redirectTo: 'pages/dashboard' },  // qualquer rota inexistente → dashboard
];
