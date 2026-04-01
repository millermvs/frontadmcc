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
  role: string;        // 'ADM_CC' | 'DIRETOR' | 'ASSOCIADO'
  idAssociado: number | null;  // null para ADM sem associado vinculado
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
  role: string;
  idAssociado: number | null;
}
