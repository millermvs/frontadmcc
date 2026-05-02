import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// ============================================================
// Guards de Rota
// ============================================================
//
// Analogia direta com o SecurityConfig do backend:
//
//   Backend (SecurityConfig):
//     .requestMatchers("/auth/login").permitAll()      ← rota pública
//     .anyRequest().authenticated()                     ← authGuard
//     .hasRole("ADM")                                   ← roleGuard('ADM_CC')
//
//   Frontend (este arquivo):
//     { path: 'login', component: Login }               ← sem guard (pública)
//     { path: 'pages', canActivate: [authGuard] }       ← authGuard
//     { path: 'admin', canActivate: [roleGuard('ADM_CC')] }  ← roleGuard
//
// Guards são "porteiros" de rotas. O Angular chama o guard
// ANTES de carregar o componente. Se o guard retorna false,
// o componente nem carrega — redireciona para outro lugar.
//
// ── CanActivateFn ──────────────────────────────────────────
// Assim como o interceptor, guards modernos (Angular 15+) são
// funções simples em vez de classes. Mais leve, mais direto.
// ============================================================

/**
 * authGuard — Verifica se o usuário está logado.
 *
 * Equivale ao .anyRequest().authenticated() do SecurityConfig.
 * Se não está logado, redireciona para /login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAutenticado()) {
    return true; // pode acessar a rota
  }

  // Não logado → manda pro login
  // O createUrlTree é a forma "correta" de redirecionar em guards.
  // Ele retorna uma "instrução de navegação" em vez de navegar direto.
  // Analogia: é como retornar um ResponseEntity.redirect() em vez de
  // fazer response.sendRedirect() manualmente.
  return router.createUrlTree(['/login']);
};

/**
 * dashboardGuard — Redireciona o associado para o seu próprio painel.
 *
 * Aplicado à rota /pages/dashboard.
 * ADM_CC e DIRETOR → acessam o dashboard normal (retorna true).
 * ASSOCIADO        → redirecionado para /pages/dashboard-associado.
 *
 * Isso evita que o associado veja dados administrativos da rede toda.
 */
export const dashboardGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.temPermissao('ASSOCIADO')) {
    return router.createUrlTree(['/pages/dashboard-associado']);
  }

  return true;
};

/**
 * roleGuard — Verifica se o usuário tem a role necessária.
 *
 * Equivale ao .hasRole('ADM') do @PreAuthorize no backend.
 *
 * Uso no app.routes.ts:
 *   canActivate: [roleGuard('ADM_CC')]
 *   canActivate: [roleGuard('ADM_CC', 'DIRETOR')]
 *
 * IMPORTANTE: assim como no backend o @PreAuthorize não substitui
 * o .authenticated(), aqui o roleGuard deve ser usado JUNTO com
 * o authGuard (ou dentro de uma rota que já tem authGuard no pai).
 *
 * ── Por que é uma função que RETORNA uma função? ───────────
 * Porque o Angular espera CanActivateFn (sem parâmetros custom).
 * Para passar as roles permitidas, usamos uma "factory function"
 * que fecha sobre os parâmetros (closure).
 * Analogia: é como um @Bean que retorna um Filter configurado.
 */
export const roleGuard = (...rolesPermitidas: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.temPermissao(...rolesPermitidas)) {
      return true;
    }

    // Tem login mas não tem a role → volta pro dashboard
    // (não pro login, porque ele ESTÁ logado — só não tem permissão)
    return router.createUrlTree(['/pages/dashboard']);
  };
};
