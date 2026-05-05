import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, RegisterRequestDto, UsuarioLogado } from './auth.model';

/**
 * AuthService
 *
 * Responsavel por autenticar, armazenar a identidade do usuario logado
 * e expor signals reativos consumidos pela UI.
 *
 * Ver CLAUDE.md secao 10 (Autenticacao e Seguranca) e 10.5 (Analogias
 * Backend <-> Frontend) — este arquivo implementa diretamente o que
 * esta descrito nessas secoes.
 *
 * Distincao critica role vs perfil (secao 10.1):
 *   - role   → mecanismo do Spring Security ('ROLE_ADM', 'ROLE_ASSOCIADO')
 *   - perfil → logica de negocio ('ADM_CC', 'DIRETOR', 'ASSOCIADO')
 * A UI deve decidir visibilidade com `perfil`, nunca com `role`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly STORAGE_KEY_TOKEN = 'admcc_token';
  private readonly STORAGE_KEY_USUARIO = 'admcc_usuario';

  /** Estado interno mutavel — nao exposto diretamente. */
  private _usuario = signal<UsuarioLogado | null>(this.carregarUsuario());

  /** Usuario logado (null quando nao autenticado). */
  usuario = this._usuario.asReadonly();

  /** True quando ha usuario armazenado. */
  isAutenticado = computed(() => this._usuario() !== null);

  /** Role Spring Security — usar SOMENTE para integracao com o backend. */
  role = computed(() => this._usuario()?.role ?? null);

  /** Perfil de negocio — fonte de verdade para decisoes de UI. */
  perfil = computed(() => this._usuario()?.perfil ?? null);

  /** ID da equipe do associado logado. Null para ADM sem equipe. */
  idEquipe = computed(() => this._usuario()?.idEquipe ?? null);

  /**
   * POST /auth/login. Ao receber a resposta, persiste token + usuario
   * e atualiza o signal — a UI reage automaticamente.
   */
  login(credenciais: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(environment.api.auth.login, credenciais)
      .pipe(
        tap((response) => {
          localStorage.setItem(this.STORAGE_KEY_TOKEN, response.token);

          const usuario: UsuarioLogado = {
            nome: response.nome,
            email: response.email,
            role: response.role,
            perfil: response.perfil,
            idAssociado: response.idAssociado,
            idEquipe: response.idEquipe,
          };
          localStorage.setItem(this.STORAGE_KEY_USUARIO, JSON.stringify(usuario));

          this._usuario.set(usuario);
        })
      );
  }

  /**
   * POST /auth/register.
   * Cria as credenciais de acesso de um associado.
   * Chamado pelo ADM antes de confirmar a ativação (PREATIVO → ATIVO).
   *
   * Nao altera o estado de autenticacao do ADM logado —
   * apenas envia os dados e retorna void.
   */
  registrar(dados: RegisterRequestDto): Observable<void> {
    return this.http.post<void>(environment.api.auth.register, dados);
  }

  /**
   * Logout: limpa storage, zera o signal e redireciona.
   * Nao chama o backend — o JWT e stateless (ver CLAUDE.md 10.5).
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY_TOKEN);
    localStorage.removeItem(this.STORAGE_KEY_USUARIO);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  /** Token bruto para uso do interceptor. */
  getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_TOKEN);
  }

  /**
   * Verifica se o perfil atual esta entre os permitidos.
   * Use apenas para visibilidade de UI — o backend continua sendo a
   * autoridade de autorizacao (ver CLAUDE.md 10.5).
   */
  temPermissao(...perfisPermitidos: string[]): boolean {
    const perfilAtual = this.perfil();
    if (!perfilAtual) return false;
    return perfisPermitidos.includes(perfilAtual);
  }

  /**
   * Rehidrata o usuario ao subir a aplicacao. Se o JSON estiver corrompido,
   * limpa tudo e comeca deslogado.
   */
  private carregarUsuario(): UsuarioLogado | null {
    const json = localStorage.getItem(this.STORAGE_KEY_USUARIO);
    if (!json) return null;

    try {
      return JSON.parse(json) as UsuarioLogado;
    } catch {
      localStorage.removeItem(this.STORAGE_KEY_USUARIO);
      localStorage.removeItem(this.STORAGE_KEY_TOKEN);
      return null;
    }
  }
}
