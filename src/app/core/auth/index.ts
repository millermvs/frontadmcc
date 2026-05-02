// ============================================================
// Barrel Export — core/auth
// ============================================================
// Permite importar tudo de auth com um único caminho:
//   import { AuthService, authGuard } from './core/auth';
//
// Em vez de:
//   import { AuthService } from './core/auth/auth.service';
//   import { authGuard } from './core/auth/auth.guard';
//
// Analogia backend: é como ter um package-info.java que
// "reexporta" as classes públicas do pacote.
// ============================================================

export { AuthService } from './auth.service';
export { authInterceptor } from './auth.interceptor';
export { authGuard, roleGuard, dashboardGuard } from './auth.guard';
export { Login } from './login/login';
export * from './auth.model';
