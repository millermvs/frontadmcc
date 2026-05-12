---
name: planejamento-frontend
description: >
  Use esta skill sempre que o usuário quiser transformar um "Guia Frontend" (gerado pelo backend)
  em uma lista de tarefas pequenas e ordenadas para implementação Angular.
  Triggers: "planeja as tarefas", "divide em tarefas", "monta as tarefas do frontend",
  "quero implementar esse guia", "quais são as tarefas para implementar X",
  "me dá as tarefas de implementação", "quebra em tarefas pequenas", "como implemento esse guia".
  Acione sempre que o usuário compartilhar um arquivo de guia de integração frontend e quiser
  saber o que precisa ser feito — mesmo que não use a palavra "tarefa" explicitamente.
---

# Skill: Planejamento de Tarefas Frontend a partir do Guia de Integração

## O que esta skill produz

Uma lista ordenada de tarefas pequenas e atômicas para implementar um módulo Angular completo,
a partir de um "Guia Frontend" gerado pelo backend. Cada tarefa é independente o suficiente para
ser executada e verificada em uma sessão de trabalho, e referencia os arquivos concretos do projeto.

## Contexto do projeto

O projeto é o **Painel Administrativo ADM C+C**, feito em Angular com signals. A estrutura de
arquivos padrão para qualquer módulo é:

- `src/app/models/nome-modulo.model.ts` — interfaces TypeScript, type aliases, enums
- `src/app/services/nome-modulo.service.ts` — métodos HTTP
- `src/app/components/pages/nome-modulo/nome-modulo.ts` — componente principal
- `src/app/components/pages/nome-modulo/nome-modulo.html` — template
- `src/app/components/pages/nome-modulo/modais/` — modais de ação (cada um com `.ts` e `.html`)
- `src/app/app.routes.ts` — rota com lazy loading

## Como ler o guia antes de planejar

Antes de listar qualquer tarefa, percorra o guia completo nesta ordem:

1. **Visão geral do fluxo** — quantos endpoints existem? Qual o ciclo de vida do recurso? Quais
   ações o usuário pode tomar?
2. **Interfaces de resposta** — quais DTOs o backend retorna? Há sub-objetos (histórico,
   validações, listas aninhadas)?
3. **Formulários** — quantos formulários diferentes existem? Quais campos são condicionais?
   Quais validações são client-side vs. rejeitadas com 422 pelo backend?
4. **Enums** — quantos enums precisam virar TypeScript? Quais têm campo de texto livre condicional?
5. **Erros** — quais mensagens de erro específicas o backend retorna? Há algum padrão novo que
   o interceptor atual não trata?

Só comece a montar as tarefas após ter esse mapa completo. Tarefas mal-planejadas surgem quando
se começa a listar sem entender o todo.

## Ordem padrão das tarefas

Siga sempre esta sequência para qualquer módulo:

1. **Model** — interfaces e enums TypeScript
2. **Service** — métodos HTTP (um por endpoint)
3. **Listagem** — componente de listagem com paginação (se o módulo tem lista)
4. **Formulário de criação** — formulário principal (agendar, cadastrar, etc.)
5. **Modais de ação** — uma tarefa por modal (editar, reagendar, cancelar, etc.)
6. **Formulário de validação** — se o módulo tem uma etapa de validação/confirmação pós-evento
7. **Roteamento** — adicionar a rota em `app.routes.ts` com lazy loading
8. **Integração de erros** — somente se há padrão novo de erro não coberto pelo interceptor atual

Não crie uma tarefa "Criar o módulo X" genérica. A força desta abordagem é que cada tarefa
corresponde a **um arquivo ou uma interação bem definida**.

## Como escrever cada tarefa

Cada tarefa deve ter exatamente estes cinco elementos:

### 📋 Tarefa N — [Título direto e descritivo]

**Objetivo:** Uma ou duas frases dizendo o que será criado e por quê existe.

**Arquivos:**
- Criar: `caminho/do/arquivo.ts`
- Editar: `caminho/de/outro/arquivo.ts` _(motivo: adicionar rota, etc.)_

**Regras críticas:**
- Liste apenas as regras que podem causar bug silencioso ou rejeição 422 se ignoradas
- Campos condicionais, validações cruzadas, restrições de negócio do guia
- O que o backend calcula automaticamente (não enviar no body)
- Prazos, antecedências mínimas, estados que bloqueiam ações

**Critério de conclusão:** Uma frase objetiva descrevendo quando a tarefa está pronta.
Deve ser verificável: "o formulário abre, preenche os campos X e Y, e a requisição POST
é disparada com o body correto".

---

## Regras de tamanho de tarefa

Uma tarefa bem dimensionada:
- Cria ou modifica no máximo **2-3 arquivos**
- Pode ser implementada em **1-2 horas** por quem conhece o projeto
- Tem um único ponto de verificação claro

Se uma tarefa natural for grande (ex: formulário de validação com prospects dinâmicos e
tangibilidades com checkboxes), quebre em sub-tarefas: "6a — estrutura do formulário de
validação" e "6b — lista dinâmica de prospects e tangibilidades".

## O que incluir no final da lista

Depois da última tarefa, adicione uma seção **"Pontos de atenção transversais"** com observações
que afetam mais de uma tarefa mas não pertencem a nenhuma delas especificamente — por exemplo:
- Campos que o backend **nunca** espera no body (o status, o ID do solicitante extraído do JWT)
- Padrões de UX mencionados no guia que aparecem em múltiplos formulários
- Prazo de expiração que precisa ser monitorado no frontend
- Endpoints que qualquer autenticado pode chamar vs. que têm restrição de participante no negócio

## Tom e formato do output

- Escreva em **português**
- Use os ícones de seção (📋, **Objetivo**, **Arquivos**, etc.) exatamente como no template acima
- Numere as tarefas sequencialmente a partir de 1
- Não escreva introduções longas — vá direto para a Tarefa 1
- Se o guia tiver seções numeradas (1, 2, 3...), mencione-as por número nas regras críticas
  para facilitar consulta: "ver seção 4 do guia"

## Exemplo de regra crítica bem escrita vs. mal escrita

❌ Ruim: "Validar os campos do formulário."

✅ Bom: "Quando `tipo = 'PRESENCIAL'`, o campo `local` torna-se obrigatório — validar no
Angular antes de submeter, pois o backend rejeita com 422 mas sem mensagem de campo (ver seção 4)."

A diferença: a regra boa diz **o que** acionar, **em que condição**, e **qual consequência** se
ignorada. Escreva todas as regras críticas com esse nível de especificidade.