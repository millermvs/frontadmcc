---
paths:
  - "**/environment*.ts"
  - "**/*.service.ts"
---

# Environments e configuração

<!--
  Carrega ao mexer em environments OU em services (porque é lá que as
  URLs são consumidas). A regra "nunca hardcode URL no service" só faz
  sentido se ambos os arquivos forem o gatilho.
-->

## Estrutura

| Ambiente | Arquivo | URL Base | Características |
|---|---|---|---|
| **Desenvolvimento** | `environment.development.ts` | `http://localhost:8080/api/v1` | CORS permissivo, logs verbose |
| **Produção** | `environment.ts` | `https://apiadmcc.automica.com.br/api/v1` | CORS restrito, sem logs de debug |

## Organização dos endpoints

Todos os endpoints centralizados no objeto `environment.api`:

```
environment.api.dominio.metodo
```

- **Endpoints estáticos:** propriedade string. Ex: `listar: \`${baseUrl}/equipes\``
- **Endpoints dinâmicos:** função que recebe ID. Ex: `buscarPorId: (id: number) => \`${baseUrl}/equipes/${id}\``

**Namespaces existentes:**
`auth`, `associados`, `anuidades`, `renovacoes`, `cargosLideranca`, `associadosCargos`, `enderecosResidenciais`, `grupamentos`, `associadosGrupamentos`, `visibilidade`, `equipes`, `equipesCargosAtivos`, `equipesDesignacao`, `equipesDiretorEquipe`, `equipesDiretorTerritorio`, `diretoresEquipe`, `diretoresTerritorio`, `locaisPresenciais`, `pontuacaoFaixas`, `clusters`, `atuacoesEspecificas`, `empresas`, `enderecosComerciais`, `perfisAssociado`, `produtos` (Stripe).

**Regra:** toda URL da API é definida no environment. **Nunca** hardcoded no service.

## Regras de configuração

- **Segredos:** nunca hardcoded. Variáveis de ambiente via CI/CD.
- **Environments sincronizados:** todo novo endpoint adicionado em `environment.ts` **deve** ser adicionado em `environment.development.ts` também (e vice-versa).
- **File replacements:** o `angular.json` troca automaticamente o environment no build de dev.
