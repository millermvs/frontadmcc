import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, UsuarioLogado } from './auth.model';

// ============================================================
// AuthService
// ============================================================
// Analogia backend:
//
//   Backend                          Frontend (este arquivo)
//   ─────────────────────────────    ─────────────────────────
//   AuthService.autenticar()     →   login()
//   TokenService.gerarToken()    →   o backend gera, a gente só GUARDA
//   TokenService.validarToken()  →   isAutenticado() (verifica se existe)
//   SecurityFilter               →   AuthInterceptor (próximo arquivo)
//   SecurityContextHolder        →   localStorage + signals
//
// O backend GERA e VALIDA o token.
// O frontend ARMAZENA e ENVIA o token em cada requisição.
//
// Usamos signals (Angular 16+) para reatividade:
// quando o usuário loga/desloga, qualquer componente que
// lê "usuario()" ou "isAutenticado()" atualiza automaticamente.
// É como um @Observable do Spring, mas no frontend.
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);

  // ── Chaves do localStorage ──────────────────────────────
  // O localStorage é o "banco de dados" do navegador.
  // Persiste mesmo se o usuário fechar a aba e voltar depois.
  // Analogia: é como a session do servidor, mas no cliente.
  private readonly STORAGE_KEY_TOKEN = 'admcc_token';
  private readonly STORAGE_KEY_USUARIO = 'admcc_usuario';

  // ── Signals reativos ────────────────────────────────────
  // Signals são a forma moderna do Angular de "avisar" os
  // componentes que algo mudou. Quando o valor muda, tudo
  // que depende dele re-renderiza automaticamente.
  //
  // Analogia backend: imagine que o SecurityContextHolder
  // pudesse notificar todos os controllers quando o usuário
  // muda — signals fazem isso no frontend.

  /** Dados do usuário logado (null se não logado) */
  private _usuario = signal<UsuarioLogado | null>(this.carregarUsuario());

  /** Signal público (somente leitura) do usuário */
  usuario = this._usuario.asReadonly();

  /** Computed: true se existe usuário logado */
  isAutenticado = computed(() => this._usuario() !== null);

  /** Computed: role do usuário ('ADM_CC', 'DIRETOR', etc.) */
  role = computed(() => this._usuario()?.role ?? null);

  // ── Login ───────────────────────────────────────────────
  /**
   * Chama POST /auth/login e armazena o resultado.
   *
   * Fluxo completo:
   * 1. Frontend envia { email, senha } para o backend
   * 2. Backend valida com AuthenticationManager + BCrypt
   * 3. Backend gera JWT com TokenService.gerarToken()
   * 4. Backend retorna { token, nome, email, role, idAssociado }
   * 5. Frontend guarda tudo no localStorage
   * 6. Frontend atualiza o signal _usuario
   * 7. A partir daqui, o AuthInterceptor injeta o token em toda requisição
   *
   * O tap() é um operador RxJS que executa um "efeito colateral"
   * sem alterar o fluxo de dados. Analogia: é como um @AfterReturning
   * do AOP — roda depois que a resposta chega, mas não muda ela.
   */
  login(credenciais: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(environment.api.auth.login, credenciais)
      .pipe(
        tap((response) => {
          // Guarda o token separado (o interceptor só precisa dele)
          localStorage.setItem(this.STORAGE_KEY_TOKEN, response.token);

          // Guarda os dados do usuário (sem o token, por segurança)
          const usuario: UsuarioLogado = {
            nome: response.nome,
            email: response.email,
            role: response.role,
            idAssociado: response.idAssociado,
          };
          localStorage.setItem(this.STORAGE_KEY_USUARIO, JSON.stringify(usuario));

          // Atualiza o signal → todos os componentes que dependem são notificados
          this._usuario.set(usuario);
        })
      );
  }

  // ── Logout ──────────────────────────────────────────────
  /**
   * Remove tudo do localStorage e redireciona para /login.
   *
   * Não precisa chamar o backend — o JWT é stateless.
   * O servidor não guarda sessão, então "deslogar" é apenas
   * apagar o token do lado do cliente.
   *
   * Analogia: é como se o SecurityContextHolder.clearContext()
   * apagasse a autenticação, mas aqui é no navegador.
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY_TOKEN);
    localStorage.removeItem(this.STORAGE_KEY_USUARIO);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  // ── Getters ─────────────────────────────────────────────

  /** Retorna o token JWT puro (usado pelo AuthInterceptor) */
  getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_TOKEN);
  }

  /**
   * Verifica se o usuário tem uma das roles permitidas.
   *
   * Uso: authService.temPermissao('ADM_CC')
   *      authService.temPermissao('ADM_CC', 'DIRETOR')
   *
   * Analogia backend: é como o hasRole('ADM') do @PreAuthorize,
   * mas rodando no cliente para decidir o que MOSTRAR na tela.
   *
   * IMPORTANTE: isso NÃO substitui a validação do backend.
   * O backend continua fazendo @PreAuthorize em cada endpoint.
   * Aqui é só para a experiência do usuário — esconder botões
   * que ele não pode usar, em vez de deixar ele clicar e receber 403.
   */
  temPermissao(...rolesPermitidas: string[]): boolean {
    const roleAtual = this.role();
    if (!roleAtual) return false;
    return rolesPermitidas.includes(roleAtual);
  }

  // ── Helpers privados ────────────────────────────────────

  /**
   * Carrega o usuário do localStorage ao iniciar o service.
   * Chamado no construtor do signal _usuario.
   *
   * Isso permite que, se o usuário fechar o navegador e voltar,
   * ele continue logado (desde que o token não tenha expirado
   * no backend — 8h conforme o TokenService).
   */
  private carregarUsuario(): UsuarioLogado | null {
    const json = localStorage.getItem(this.STORAGE_KEY_USUARIO);
    if (!json) return null;

    try {
      return JSON.parse(json) as UsuarioLogado;
    } catch {
      // Se o JSON estiver corrompido, limpa tudo
      localStorage.removeItem(this.STORAGE_KEY_USUARIO);
      localStorage.removeItem(this.STORAGE_KEY_TOKEN);
      return null;
    }
  }
}
