# Checklist de review

<!--
  Sem `paths:` mas é o arquivo mais leve. Carrega sempre, mas é tão
  curto que não pesa. Funciona como "lembrete pendurado" para o Claude
  considerar antes de declarar uma feature pronta.

  EVOLUÇÃO POSSÍVEL: virar uma Skill quando o Claude Code suportar bem.
  Aí carrega só quando você disser "Claude, revisa essa feature pelo
  checklist". Por ora, fica como rule.
-->

Use esta checklist antes de considerar qualquer feature completa.

- [ ] **Separação de camadas respeitada?** Componente → Service → API, sem pulos.
- [ ] **DTOs separados?** RequestDto ≠ ResponseDto ≠ dados do template.
- [ ] **Tipagem forte?** Nenhum `any`, tipos de retorno explícitos.
- [ ] **Signals corretos?** Estado local com `signal()`, derivados com `computed()`.
- [ ] **Lazy loading?** Componente de página carregado sob demanda.
- [ ] **Guard aplicado?** Rota protegida por `authGuard` e/ou `roleGuard`.
- [ ] **Permissões visuais?** Elementos ADM-only escondidos para outros perfis.
- [ ] **Tratamento de erro?** `subscribe` com handler de erro, mensagem legível.
- [ ] **Feedback visual?** Loading, toast de sucesso/erro, estados vazios.
- [ ] **Validação frontend?** Campos obrigatórios, formato, tamanho validados no form.
- [ ] **Responsivo?** Funciona em desktop, tablet e mobile.
- [ ] **CSS no arquivo próprio?** Nenhum style inline no template.
- [ ] **Nomenclatura consistente?** Arquivo, classe, método, selector no padrão.
- [ ] **Environment atualizado?** Novo endpoint em ambos os environments.
- [ ] **Rota adicionada?** Em `app.routes.ts` com lazy loading.
- [ ] **Menu atualizado?** Item no navbar (se for página nova).
- [ ] **Modais via ModalService?** Nenhuma tag de modal no template da página.
- [ ] **Testes escritos?** Renderização, interação, erro cobertas.
