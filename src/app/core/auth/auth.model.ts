// ============================================================
// DTOs de Autenticação
// ============================================================
// Analogia backend: são os equivalentes ao LoginRequestDto e
// ao objeto que o AuthController retorna no body do response.
//
// No backend:   AuthController recebe LoginRequestDto → retorna { token, nome, email, role, idAssociado }
// No frontend:  AuthService envia LoginRequest       → recebe LoginResponse
// ============================================================

/**
 * Corpo do POST /auth/login
 * Equivale ao LoginRequestDto do backend
 */
export interface LoginRequest {
  email: string;
  senha: string;
}

/**
 * Resposta do POST /auth/login
 * Espelha exatamente o que o AuthController retorna
 */
export interface LoginResponse {
  token: string;
  nome: string;
  email: string;
  role: string;         // 'ROLE_ADM' | 'ROLE_ASSOCIADO' — usado pelo Spring Security
  perfil: string;       // 'ADM_CC' | 'DIRETOR' | 'ASSOCIADO' — use este para decisões de UI
  idAssociado: number | null;  // null para ADM sem associado vinculado
}

/**
 * Corpo do POST /auth/register
 * Equivale ao RegisterRequest do backend.
 * Usado pelo ADM para criar as credenciais de acesso de um associado.
 *
 * role: sempre 'ROLE_ASSOCIADO' nesse fluxo (fixo no componente).
 * cpf: obrigatório apenas para ROLE_ASSOCIADO.
 */
export interface RegisterRequestDto {
  nomeCompleto: string;
  email: string;
  senha: string;
  role: 'ROLE_ASSOCIADO';
  cpf: string;
}

/**
 * Dados do usuário logado — extraídos do LoginResponse
 * e armazenados no localStorage para uso durante a sessão.
 *
 * Analogia backend: é como o UsuarioAutenticado que o
 * SecurityFilter injeta no SecurityContextHolder.
 * Lá ele fica disponível para toda a request.
 * Aqui fica disponível para toda a sessão do navegador.
 */
export interface UsuarioLogado {
  nome: string;
  email: string;
  role: string;         // mantido para não quebrar código legado
  perfil: string;       // fonte de verdade para controle de UI
  idAssociado: number | null;
}
