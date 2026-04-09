import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// ============================================================
// App (Root Component)
// ============================================================
// Componente raiz da aplicação. Contém APENAS o <router-outlet>
// global — sem navbar, sem layout.
//
// A navbar e o layout ficam no componente Layout, que é carregado
// SOMENTE para as rotas protegidas (/pages/**).
// Isso garante que /login renderiza "puro", sem sidebar.
//
// Repare que removemos o import do Navbar daqui — ele agora
// é importado pelo Layout, que é o dono da estrutura visual.
// ============================================================

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('admccfront');
}
