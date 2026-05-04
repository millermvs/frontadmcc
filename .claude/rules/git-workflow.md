# Git workflow

<!--
  Sem `paths:` → carrega sempre, mas pequeno. Hábito de equipe.
-->

## Commits

- Mensagens descritivas no imperativo: "Implementa listagem de equipes com filtros".
- Um commit = uma unidade lógica de mudança.
- **Nunca commitar:** `node_modules/`, `.angular/`, `dist/`, arquivos `.env`, configs de IDE pessoais.

## Branches

| Branch | Propósito |
|---|---|
| `main` / `master` | Produção, sempre estável |
| `develop` | Integração antes de ir para main |
| `feature/*` | Nova funcionalidade |
| `fix/*` | Correção de bug |
| `hotfix/*` | Correção urgente em produção |

## .gitignore obrigatório

Deve incluir no mínimo:
```
node_modules/
.angular/
dist/
.env
.vscode/        # exceto extensions.json
.idea/
*.local
```
