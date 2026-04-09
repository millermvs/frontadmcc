import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../navbar/navbar';

// ============================================================
// Layout
// ============================================================
// Componente wrapper que define o layout padrão das páginas
// protegidas (com navbar lateral + área de conteúdo).
//
// Analogia backend: pense no SecurityFilterChain do Spring.
// Lá, você define QUAIS filtros rodam para QUAIS rotas.
// Aqui é a mesma ideia, mas visual:
//
//   SecurityFilterChain → filtra requests de /api/**
//   Layout              → envolve rotas de /pages/**
//
// As rotas de /pages usam este componente como "casca".
// A rota /login NÃO usa — por isso não vê a navbar.
//
// No Angular isso é feito via rota com loadComponent + children:
//   { path: 'pages', loadComponent: Layout, children: [...] }
// O <router-outlet> dentro DESTE template é onde as páginas
// filhas (dashboard, equipes, etc.) são renderizadas.
// ============================================================

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Navbar],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {}
