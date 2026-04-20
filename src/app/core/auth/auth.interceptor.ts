import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * authInterceptor (functional interceptor — Angular 15+)
 *
 * IDA:   injeta Authorization: Bearer <token> em toda requisicao autenticada.
 * VOLTA: se o backend responder 401, forca logout para renovar o fluxo.
 *
 * Ver CLAUDE.md 10.1 (fluxo de autenticacao) e 10.5 (analogias com
 * SecurityFilter do backend e imutabilidade do HttpRequest).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const token = authService.getToken();
  const reqComToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(reqComToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
