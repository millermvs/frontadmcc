import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

// ============================================================
// Configuração global da aplicação
// ============================================================
//
// Analogia backend: este arquivo é o equivalente ao
// @SpringBootApplication + @Configuration do Spring.
// Ele registra tudo que a aplicação precisa para funcionar.
//
// provideRouter       → como o @EnableWebMvc que registra as rotas
// provideHttpClient   → como o RestTemplate/WebClient que faz HTTP
// withInterceptors    → como registrar o SecurityFilter na cadeia de filtros
//
// ── withInterceptors([authInterceptor]) ────────────────────
// Isso registra o authInterceptor na "cadeia" de interceptors.
// Toda requisição HTTP que qualquer service fizer vai passar
// por ele ANTES de sair do navegador.
//
// No backend, o SecurityFilter é registrado via SecurityConfig:
//   .addFilterBefore(securityFilter, UsernamePasswordAuthenticationFilter.class)
//
// Aqui é o equivalente: o withInterceptors registra na mesma ideia.
// ============================================================

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])  // ← interceptor registrado aqui
    ),
  ],
};
