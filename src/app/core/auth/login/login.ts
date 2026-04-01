import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { LoginRequest } from '../auth.model';

// ============================================================
// Componente de Login
// ============================================================
// Tela simples: email + senha + botão.
//
// Fluxo:
// 1. Usuário preenche email e senha
// 2. Clica em "Entrar"
// 3. Componente chama authService.login()
// 4. Se sucesso → redireciona para /pages/dashboard
// 5. Se erro → mostra mensagem na tela
//
// ── FormsModule vs ReactiveFormsModule ─────────────────────
// Para formulários simples (poucos campos, sem validação
// complexa), o FormsModule com [(ngModel)] é suficiente.
// Para formulários grandes (Associado, Seguro) vamos usar
// ReactiveFormsModule — mas isso é para as próximas páginas.
//
// Analogia: FormsModule é como usar @RequestParam no controller.
// ReactiveFormsModule é como usar @Valid @RequestBody com DTO.
// Para login, @RequestParam basta.
// ============================================================

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);

  // ── Estado do formulário ────────────────────────────────
  // Signals controlam o estado reativo da tela.
  // Quando qualquer signal muda, o Angular atualiza SOMENTE
  // as partes do HTML que dependem dele (não a tela toda).

  email = signal('');
  senha = signal('');
  carregando = signal(false);    // true enquanto aguarda o backend
  mensagemErro = signal('');     // mensagem exibida ao usuário

  // ── Método de login ─────────────────────────────────────
  /**
   * Chamado quando o usuário clica em "Entrar" ou pressiona Enter.
   *
   * O subscribe() é como o .thenAccept() de um CompletableFuture
   * no Java — ele "ouve" quando a resposta chega (ou quando dá erro).
   *
   * next: executado quando a resposta chega com sucesso
   * error: executado quando o backend retorna erro (4xx, 5xx)
   */
  onLogin(): void {
    // Limpa erro anterior e ativa loading
    this.mensagemErro.set('');
    this.carregando.set(true);

    const credenciais: LoginRequest = {
      email: this.email(),
      senha: this.senha(),
    };

    this.authService.login(credenciais).subscribe({
      next: () => {
        // Login OK → redireciona para o dashboard
        this.router.navigate(['/pages/dashboard']);
      },
      error: (err) => {
        this.carregando.set(false);

        // O backend retorna 403 para credenciais inválidas
        // (AuthenticationManager lança BadCredentialsException)
        if (err.status === 403 || err.status === 401) {
          this.mensagemErro.set('E-mail ou senha incorretos.');
        } else if (err.status === 0) {
          // status 0 = servidor não respondeu (CORS ou offline)
          this.mensagemErro.set('Servidor indisponível. Tente novamente.');
        } else {
          this.mensagemErro.set('Erro inesperado. Tente novamente.');
        }
      },
    });
  }
}
