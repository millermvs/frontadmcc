import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// ============================================================
// AuthInterceptor (Functional Interceptor)
// ============================================================
//
// Para entender este arquivo, pense no fluxo de ida e volta
// de uma requisição HTTP:
//
//   Componente → Service → [INTERCEPTOR IDA] → Backend
//   Componente ← Service ← [INTERCEPTOR VOLTA] ← Backend
//
// Na IDA:  injeta o header Authorization: Bearer <token>
// Na VOLTA: se o backend responder 401, faz logout automático
//
// Analogia backend (mas invertida):
//
//   SecurityFilter do backend:
//     → RECEBE o token do header → valida → injeta no SecurityContext
//
//   AuthInterceptor do frontend (este arquivo):
//     → PEGA o token do localStorage → COLOCA no header → envia
//
// O SecurityFilter é um "porteiro" que VERIFICA quem entra.
// O AuthInterceptor é um "carteirinha" que APRESENTA o crachá.
//
// ── Por que "Functional Interceptor"? ──────────────────────
// Angular 15+ introduziu interceptors como funções simples
// (em vez de classes com implements HttpInterceptor).
// É mais leve e direto. A assinatura HttpInterceptorFn já
// é reconhecida pelo provideHttpClient(withInterceptors(...)).
// ============================================================

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const router = inject(Router);

  // ── IDA: injeta o token ─────────────────────────────────
  const token = authService.getToken();

  // Se tem token, clona a requisição adicionando o header.
  // Por que clonar? Requisições HTTP no Angular são IMUTÁVEIS
  // (como records no Java) — não dá pra mutar, precisa criar
  // uma cópia com a alteração.
  //
  // Analogia: é como se no backend, em vez de alterar o
  // HttpServletRequest, você criasse um novo wrapper.
  const reqComToken = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  // ── VOLTA: trata erros de autenticação ──────────────────
  return next(reqComToken).pipe(
    catchError((error: HttpErrorResponse) => {

      // 401 = token expirado ou inválido
      // O backend retorna 401 quando o SecurityFilter não
      // consegue validar o token (TokenService.validarToken()
      // retorna string vazia).
      //
      // Quando isso acontece, a sessão "morreu" — o token
      // tem 8h de vida conforme o TokenService do backend.
      // A melhor experiência é deslogar e mandar pro login.
      if (error.status === 401) {
        authService.logout(); // limpa localStorage + redireciona
      }

      // Propaga o erro para que o componente também possa
      // tratar (ex: mostrar toast de erro)
      return throwError(() => error);
    })
  );
};
