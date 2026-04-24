/**
 * TOAST COMPONENT
 *
 * Renderiza a notificação flutuante gerenciada pelo ToastService.
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Não tem lógica própria — só lê o signal do ToastService e exibe
 * - Registrado no layout.html (uma vez, disponível para todas as páginas)
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  protected readonly toastService = inject(ToastService);
}
