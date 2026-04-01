# Fluxos Completos — Sistema de Gestão ADM C+C
### Atualizado em 01/04/2026 — Baseado no código real do projeto

---

## 000 - Fluxo de Testes

O projeto usa JUnit 5 + Mockito + AssertJ como stack de testes. Não há banco in-memory (H2) nem TestContainers configurados — todos os testes de service são unitários puros com mocks. Existe um único teste de controller usando MockMvc com contexto de segurança simulado.

A estrutura segue o padrão do projeto: cada service tem sua classe de teste espelhada, com `@Nested` para agrupar cenários por método e `@DisplayName` descritivo em português.

**Estrutura de diretórios:**
```
src/test/java/com/br/robertmiler/gerenciamento/
├── GerenciamentoApplicationTests.java
├── applications/controllers/
│   └── AssociadosControllerTest.java
└── domain/service/
    ├── AssociadoServiceTest.java
    ├── AssociadoAnuidadeServiceTest.java
    ├── AssociadoCargoLiderancaServiceTest.java
    ├── AssociadoEnderecoResidencialServiceTest.java
    ├── AssociadoGrupamentoServiceTest.java
    ├── AssociadoVisibilidadeServiceTest.java
    ├── AtuacaoEspecificaServiceTest.java
    ├── CargoLiderancaServiceTest.java
    ├── ClusterServiceTest.java
    ├── EmpresaServiceTest.java
    ├── EmpresaEnderecoComercialServiceTest.java
    ├── EquipeServiceTest.java
    ├── EquipePontuacaoFaixaServiceTest.java
    ├── EquipeCargoAtivoServiceTest.java
    ├── EquipeDesignacaoLiderancaServiceTest.java
    ├── EquipeDiretorEquipeServiceTest.java
    ├── EquipeDiretorTerritorioServiceTest.java
    ├── EquipeLocalPresencialServiceTest.java
    ├── GrupamentoEstrategicoServiceTest.java
    ├── PerfilAssociadoServiceTest.java
    ├── VisibilidadeFiltroServiceTest.java
    └── securityservice/
        └── TokenServiceTest.java
```

**Total: 24 classes de teste (~200+ métodos de teste).**

### GerenciamentoApplicationTests
Teste de contexto Spring Boot. Verifica que a aplicação sobe sem erro. Usa `@SpringBootTest`.

### AssociadosControllerTest
Teste de controller com MockMvc e segurança simulada. Cobre quatro grupos de cenários:
- **GetPerfilFiltrado** (`GET /{cpf}/perfil`): ADM_CC recebe todos os campos, ASSOCIADO recebe apenas campos filtrados, delega corretamente para `buildViewDto` e `filtrar`.
- **PutEditarCampo** (`PUT /{cpf}/campo/{nomeCampo}`): edição bem-sucedida retorna 200, `AccessDeniedException` quando perfil não tem permissão, `RegraNegocioException` para campo não suportado.
- **PostTogglePermissao** (`POST /{cpf}/permissao/{campo}`): associado faz toggle do próprio campo retorna 204, tentativa de alterar perfil alheio retorna 403, ADM_CC pode fazer toggle em qualquer CPF.
- **GetPorId** (`GET /{idAssociado}`): retorna 200 com dados do associado.

### AssociadoServiceTest
O teste mais extenso do projeto. Cobre as regras de negócio centrais do associado:
- **DataVencimento**: ingresso 10/02/2026 → vencimento 01/03/2027; ingresso 31/12/2025 → vencimento 01/01/2027. Usa `ArgumentCaptor` para verificar o cálculo antes do save.
- **RenovacaoAnuidade**: vencimento vigente soma 12 meses ao vencimento atual; PREATIVO não pode renovar; associado ISENTO não pode renovar.
- **ConfirmarCadastro**: PREATIVO → ATIVO com sucesso; ATIVO não pode ser confirmado novamente.
- **AlterarStatus**: INATIVO_FALECIMENTO dispara `AlertaSeguroFuneralEvent` (verifica via `ApplicationEventPublisher`); status não-FALECIMENTO não dispara; INATIVO_DESISTENCIA sem motivo lança `RegraNegocioException`; INATIVO_PAUSA_PROGRAMADA sem datas lança exceção; grava histórico com `statusAnterior` correto.
- **TogglePermissao**: toggle de `aniversarioDiaMes` alterna `exibirAniversario`; campo desconhecido lança `RegraNegocioException`.

### AssociadoAnuidadeServiceTest
Cobre o ciclo completo de anuidades:
- **CadastrarAnuidade**: cadastro com sucesso sem duplicata; `JaCadastradoException` quando já existe anuidade no mesmo ano; status PAGO sem `dataPagamento` lança `RegraNegocioException`; status PAGO com `dataPagamento` cadastra com sucesso; status ISENTO não exige `dataPagamento`.
- **EditarAnuidade**: edição com sucesso; edição para PAGO sem `dataPagamento` lança exceção; anuidade inexistente lança `NaoEncontradoException`.
- **Buscas**: busca por ID retorna quando existe; busca por ID inexistente lança exceção; busca por associado retorna lista ordenada.

### AssociadoCargoLiderancaServiceTest
- **DesignarCargo**: designação com sucesso.
- **Buscas**: busca por ID inexistente lança `NaoEncontradoException`; busca por associado retorna lista.

### AssociadoEnderecoResidencialServiceTest
- **CadastrarEndereco**: cadastro com sucesso quando associado existe; associado inexistente lança `NaoEncontradoException`.
- **EditarEndereco**: edição com sucesso; endereço inexistente lança exceção.
- **Buscas**: retorna lista quando associado existe; associado inexistente lança exceção.

### AssociadoGrupamentoServiceTest
- **VincularGrupamento**: vinculação com sucesso.
- **Buscas**: busca por associado retorna lista; busca por grupamento retorna lista; busca por ID inexistente lança exceção.

### AssociadoVisibilidadeServiceTest
- **CadastrarVisibilidade**: cadastro com sucesso quando não existe visibilidade para o associado.
- **EditarVisibilidade**: edição com sucesso; inexistente lança exceção.
- **Buscas**: busca por associado retorna quando existe; associado inexistente lança exceção.

### AtuacaoEspecificaServiceTest
- **CadastrarAtuacao**: cadastro com sucesso quando nome é único para o cluster; nome duplicado no mesmo cluster lança `RegraNegocioException`; mesmo nome em cluster diferente é permitido.
- **EditarAtuacao**: edição com sucesso quando mesmo ID não conflita; edição conflita com outra atuação lança exceção.
- **Buscas**: busca por ID inexistente lança exceção.

### CargoLiderancaServiceTest
- **CadastrarCargo**: cadastro com sucesso quando nome é único; nome duplicado lança `RegraNegocioException`.
- **EditarCargo**: edição com sucesso quando nome próprio não conflita; nome conflita com outro cargo lança exceção.
- **Buscas**: busca por ID inexistente lança exceção; busca por ID retorna quando existe.

### ClusterServiceTest
- **CadastrarCluster**: cadastro com sucesso quando nome é único; nome duplicado lança `RegraNegocioException`.
- **EditarCluster**: edição com sucesso quando mesmo nome próprio não conflita; nome conflita com outro cluster lança exceção.
- **Buscas**: busca por ID inexistente lança exceção; busca por ID retorna quando existe.

### EmpresaServiceTest
- **Criar**: cadastro com sucesso; associado inexistente lança `NaoEncontradoException`.
- **EditarEmpresa**: CNPJ duplicado de outra empresa lança `JaCadastradoException`; edição com sucesso quando CNPJ é da própria empresa.
- **Buscas**: busca por ID inexistente lança exceção; busca por ID retorna DTO; busca por associado retorna paginação.

### EmpresaEnderecoComercialServiceTest
- **CadastrarEndereco**: cadastro com sucesso.
- **EditarEndereco**: edição com sucesso; inexistente lança exceção.
- **Buscas**: busca por empresa retorna quando existe; busca por empresa inexistente lança exceção.

### EquipeServiceTest
- **CadastrarEquipe**: `dataPrevisaoLancamento` é calculada como `dataInicioFormacao` + 63 dias; nome duplicado lança `RegraNegocioException`.
- **EditarEquipe**: `dataEfetivaLancamento` com < 15 ativos lança exceção; com >= 15 ativos prossegue; `dataEfetivaLancamento` null não valida mínimo; nome duplicado de outra equipe lança exceção; edição com mesmo nome própria equipe não lança.
- **CamposCalculados**: `buscarEquipePorId` preenche `numeroComponentes` e `pontuacaoMensal`; `pontuacaoMensal` retorna 0 quando nenhuma faixa contém o nº de componentes; faixa com `maximoAssociados` null captura corretamente; seleciona a faixa correta entre múltiplas faixas.
- **Buscas**: busca por ID inexistente lança exceção.

### EquipePontuacaoFaixaServiceTest
O teste mais detalhado de validação de regra de negócio. Cobre 9 cenários de sobreposição de faixas:
- Cadastro sem sobreposição quando não há faixas existentes.
- Faixas adjacentes sem sobreposição: [15-24] e [25-34].
- Sobreposição parcial: nova [20-30] sobrepõe existente [15-24].
- Nova faixa contida dentro de existente: nova [18-20] dentro de [15-24].
- Existente com `max=null` sobrepõe nova faixa acima.
- Nova faixa com `max=null` sobrepõe existente dentro do intervalo.
- Edição ignora a própria faixa na validação.
- Duas faixas com `max=null` ambas se sobrepõem.
- Faixa antes da existente sem sobreposição: nova [5-14] com existente [15-24].
- **Buscas**: busca por ID retorna/lança exceção; busca todas retorna lista ordenada; busca ativas filtra corretamente.

### EquipeCargoAtivoServiceTest
- **CadastrarCargoAtivo**: cadastro com sucesso sem duplicata; cargo já vinculado à equipe lança `JaCadastradoException`.
- **EditarCargoAtivo**: edição altera status ativo com sucesso; inexistente lança exceção.
- **Buscas**: busca por equipe retorna lista completa; busca por equipe filtra apenas ativos.

### EquipeDesignacaoLiderancaServiceTest
- **CadastrarDesignacao**: cadastro com sucesso.
- **Buscas**: inexistente lança exceção; busca por equipe retorna lista.

### EquipeDiretorEquipeServiceTest
- **CadastrarDiretor**: cadastro com sucesso.
- **Buscas**: busca por ID inexistente lança exceção; busca por equipe retorna lista.

### EquipeDiretorTerritorioServiceTest
- **CadastrarDiretor**: cadastro com sucesso.
- **Buscas**: inexistente lança exceção; busca por equipe retorna lista.

### EquipeLocalPresencialServiceTest
- **CadastrarLocal**: cadastro com sucesso.
- **EditarLocal**: edição com sucesso; inexistente lança exceção.

### GrupamentoEstrategicoServiceTest
- **CadastrarGrupamento**: cadastro com sucesso quando nome e sigla são únicos; nome duplicado lança exceção; sigla duplicada lança exceção.
- **EditarGrupamento**: edição com sucesso quando mesmos nome e sigla da própria entidade; nome conflita com outro lança exceção; sigla conflita com outro lança exceção.
- **Buscas**: busca por ID inexistente lança exceção.

### PerfilAssociadoServiceTest
- **CadastrarPerfil**: associado já com perfil lança `JaCadastradoException`; cadastro com todos campos obrigatórios → `perfilCompleto = true`; cadastro sem campo obrigatório → `perfilCompleto = false`; campo obrigatório em branco (whitespace) → `perfilCompleto = false`.
- **BuscarPerfil**: associado sem perfil lança `NaoEncontradoException`; response inclui nome do cargo ativo quando existe.

### VisibilidadeFiltroServiceTest
O segundo teste mais extenso. Cobre a lógica de visibilidade por campo via reflection:
- **AdmCcTestes**: ADM_CC vê todos os campos incluindo condicionais com boolean=false; vê status INATIVO_DESISTENCIA e INATIVO_FALECIMENTO.
- **AssociadoProprioPerfil**: vê dados pessoais; NÃO vê cpfPadrinho, dataPrimeiraPagamento, cargoLiderancaTipo; vê aniversarioDiaMes e enderecoComercial mesmo com boolean=false (é o próprio dado); NÃO vê status INATIVO_DESISTENCIA do próprio perfil.
- **AssociadoPerfilAlheio**: vê apenas campos REDE_CC; aniversarioDiaMes e enderecoComercial respeitam os booleans de toggle; NÃO vê status INATIVO_DESISTENCIA.
- **DiretorTestes**: vê campos REDE_CC como qualquer membro; NÃO vê cpfPadrinho nem status INATIVO_DESLIGADO.
- **ValidarEdicao**: ADM_CC pode editar grupamento; DIRETOR pode editar grupamento; ASSOCIADO NÃO pode editar grupamento; ASSOCIADO pode editar dataNascimento; ASSOCIADO NÃO pode editar status nem CPF; ADM_CC pode editar CPF; campo inexistente lança `AccessDeniedException`.
- **StatusVisibilidade**: PREATIVO e ATIVO são visíveis para ASSOCIADO alheio; INATIVO_DESISTENCIA, INATIVO_FALECIMENTO e INATIVO_DESLIGADO NÃO são visíveis para perfis não-ADM.

### TokenServiceTest
Teste sem mocks — instancia `TokenService` diretamente com `ReflectionTestUtils.setField()` para injetar o secret JWT:
- `gerarToken` retorna string não-vazia para ADM_CC e ASSOCIADO.
- `validarToken` retorna o subject (e-mail) após geração; retorna string vazia para token inválido e para token adulterado.
- `extrairPerfil` retorna ADM_CC, DIRETOR e ASSOCIADO conforme claim; retorna ASSOCIADO como fallback para token malformado.

---

## 0 - Fluxo de Autenticação

O modelo escolhido: JWT Stateless. A aplicação usa JWT (JSON Web Token) com Spring Security. A palavra-chave aqui é stateless — o servidor não guarda nenhuma sessão. Cada requisição carrega o próprio token, e o servidor só precisa validá-lo.

O fluxo completo é este:

```
Cliente                                      Servidor
  |                                             |
  |-- POST /api/v1/auth/login --------------->  |
  |   { email, senha }                          |
  |                                             |-- AuthService.autenticar()
  |                                             |-- AuthenticationManager valida email + BCrypt
  |                                             |-- Determina Perfil:
  |                                             |     ROLE_ADM → ADM_CC
  |                                             |     ROLE_ASSOCIADO + cargo diretor ativo → DIRETOR
  |                                             |     ROLE_ASSOCIADO sem cargo diretor → ASSOCIADO
  |                                             |-- TokenService.gerarToken()
  |                                             |     subject = email do usuário
  |                                             |     claims: "role", "perfil", "id"
  |                                             |     expira em 8h (fuso Brasília)
  |                                             |     assina com HMAC256 + secret
  |<-- { token, nome, email, role, idAssociado } |
  |                                             |
  |-- GET /api/v1/associados ---------------->  |
  |   Authorization: Bearer <token>             |
  |                                             |-- SecurityFilter intercepta
  |                                             |-- TokenService.validarToken()
  |                                             |-- busca o Usuario no banco
  |                                             |-- extrai Perfil e CPF do token
  |                                             |-- injeta UsuarioAutenticado no SecurityContextHolder
  |                                             |-- controller executa normalmente
  |<--- 200 OK -------------------------------- |
```

O detalhe mais importante: dois tipos de usuário no mesmo sistema.

Existem dois perfis com naturezas diferentes:

ROLE_ADM — usuário administrativo puro. Tem email próprio diretamente na entidade `Usuario`. Não tem `Associado` vinculado (exceto o ADM criado pelo `AssociadoAdmSeeder`, que é vinculado a um associado fictício para manter a integridade referencial).

ROLE_ASSOCIADO — o email não fica em `Usuario`. O campo `email` é `null`. O email real está em `Associado.emailPrincipal`, acessado via `@OneToOne`.

Isso gerou um problema que foi corrigido: o método `getUsername()` da entidade `Usuario` precisava saber de qual lugar buscar o email dependendo do perfil:
```java
@Override public String getUsername() {
    if (associado != null) return associado.getEmailPrincipal();
    return email;
}
```

Sem isso, o subject do JWT seria `null` para todo associado, quebrando login e validação silenciosamente.

O mesmo problema existia no `SecurityFilter` e no `AuthorizationService`, que precisam buscar o usuário pelo email extraído do token. A solução foi a busca encadeada:
```java
usuarioRepository.findByEmail(email)
    .or(() -> usuarioRepository.findByAssociado_EmailPrincipal(email))
    .orElseThrow(...)
```

O `SecurityFilter` vai além da autenticação: ele extrai o `Perfil` dos claims do JWT e resolve o CPF do associado (null para ADM sem associado), montando um objeto `UsuarioAutenticado(cpf, perfil)` que fica disponível no `SecurityContextHolder` para toda a request.

A determinação de perfil durante o login leva em conta o cargo do associado. Se o associado tem um cargo ativo com `atribuicaoIsenta` de nível diretor (DE_DIRETOR_DE_EQUIPE, DT1/DT2/DT3, DM1/DM2/DM3), o perfil é `DIRETOR`. Caso contrário, é `ASSOCIADO`. ADM sempre é `ADM_CC`.

Como o Spring Security sabe quem pode acessar o quê:

O `SecurityConfig` define as regras de acesso por rota:
```java
.requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
.requestMatchers(HttpMethod.POST, "/api/v1/auth/register").hasRole("ADM")
.requestMatchers(HttpMethod.POST, "/api/v1/associados").hasRole("ADM")
.requestMatchers(HttpMethod.PUT, "/api/v1/associados/**").hasRole("ADM")
.requestMatchers("/api/adm/**").hasRole("ADM")
.requestMatchers("/api/associados/me/**").hasAnyRole("ADM", "ASSOCIADO")
.anyRequest().authenticated()
```

O `@EnableMethodSecurity` também está ativo, o que significa que além das regras no config, você pode proteger métodos individualmente com `@PreAuthorize("hasRole('ADM')")` direto no controller — como já está nos controllers de Associado, Anuidade e Cargo Ativo de Equipe.

**CORS** está configurado para `http://localhost:4200` (Angular), permitindo GET, POST, PUT, DELETE, OPTIONS e PATCH com credentials habilitado.

Os `Seeders` — por que eles existem e como funcionam:

Sem um ADM inicial, ninguém consegue chamar `/auth/register` (que exige `ROLE_ADM`). Dois seeders resolvem isso com ordem garantida por `@Order`:

**AdminSeeder** (`@Order(1)`, `CommandLineRunner`): trava com `existsByRole(ROLE_ADM)` — se já existe, pula. Cria o `Usuario` ADM com email e senha vindos do `application.properties`.

**AssociadoAdmSeeder** (`@Order(2)`, `ApplicationRunner`, `@Transactional`): trava com `associadoRepository.count() > 0` — se já existe qualquer associado, pula tudo. Cria na ordem: Cluster "Adm Admin" → AtuacaoEspecifica "Admin Geral" → Equipe "C+C ADM" → Associado "Admin C+C" (CPF=00000000000, status=ATIVO) → AssociadoVisibilidade → vincula o Usuario ADM ao Associado. Dados fictícios: email=adm@admcc.com.br, telefone=00000000000, nascimento=01/01/2000.

Em produção, as credenciais do `application.properties` devem vir de variáveis de ambiente, não do arquivo commitado.

O `POST /api/v1/auth/register` permite registrar novos usuários (ADM ou ASSOCIADO). Para ASSOCIADO, o CPF é obrigatório e o `RegisterService` cria tanto o `Associado` (com dados básicos) quanto o `Usuario` vinculado na mesma transação. Para ADM, cria apenas o `Usuario` com email direto.

---

## 1 - Fluxo de Equipes

Tudo começa com a equipe. Você cadastra uma equipe via `POST /api/v1/equipes/cadastrar` e ela se torna a unidade operacional base do sistema. Sem uma equipe existindo, nenhum associado pode ser cadastrado. A entidade `Equipe` guarda não só o nome, mas também as regras fixas das reuniões semanais — dia da semana (`DiaReuniao`: TERCA/QUARTA/QUINTA/SEXTA), horário (`LocalTime`), modelo de reunião (`ModeloReuniao`: PRESENCIAL/ONLINE/HIBRIDO) e link Zoom — porque o APP precisa dessas informações toda semana para exibir ao associado o que acontece na sua equipe.

O nome da equipe deve obrigatoriamente iniciar com "C+C" (validado via `@Pattern` no DTO), ter no máximo 20 caracteres, e ser único no sistema.

O campo `dataPrevisaoLancamento` é calculado automaticamente no service como `dataInicioFormacao + 63 dias`. Se o `dataInicioFormacao` não vier no request, o mapper usa a data de hoje como default. Esse cálculo é sobrescrito toda vez que a equipe é editada — se o `dataInicioFormacao` mudar, a previsão recalcula.

O campo `dataEfetivaLancamento` tem uma regra especial: só pode ser preenchido quando a equipe tem no mínimo 15 associados ativos. O service consulta `AssociadoRepository.countComponentesAtivos(idEquipe)` — uma query JPQL customizada que conta associados ativos na equipe excluindo diretores com vigência ativa — e lança `RegraNegocioException` se o total for < 15.

O response (`EquipeResponseDto`) inclui dois campos calculados em tempo de consulta:
- `numeroComponentes`: COUNT de associados ativos na equipe, excluindo diretores de equipe e de território com vigência ativa (`dataFim = null`).
- `pontuacaoMensal`: calculada pela faixa de pontuação ativa que contém o nº de componentes. Se nenhuma faixa contém o valor, retorna 0.

A edição via `PUT /api/v1/equipes/{idEquipe}` permite alterar todos os campos mutáveis com verificação de nome único (ignorando a própria equipe). O `GET /api/v1/equipes` lista todas as equipes paginado, ordenadas por nome ascendente. O `GET /api/v1/equipes/{idEquipe}` retorna a equipe com os campos calculados.

---

## 2 - Fluxo de Clusters e Atuações Específicas

Em paralelo às equipes, você cadastra o catálogo de clusters via `POST /api/v1/clusters`. O cluster é o grande segmento de mercado do associado — Saúde, Tecnologia, Construção, etc. O nome é único no sistema, normalizado via `FormataString.primeiraLetraMaiuscula()`. O `GET /api/v1/clusters` é paginado e ordenado por nome ascendente.

Depois, dentro de cada cluster, você cadastra as atuações específicas via `POST /api/v1/atuacoes-especificas`. A atuação é a especialidade do associado dentro do cluster — por exemplo, Cluster Saúde → Atuação: Nutrição Esportiva. O request recebe `idCluster` e `nome`.

A relação entre os dois existe porque o APP faz seleção encadeada: o usuário escolhe o cluster primeiro, e o sistema filtra automaticamente só as atuações daquele cluster via `GET /api/v1/atuacoes-especificas/cluster/{idCluster}` (paginado). Uma regra importante aqui: o mesmo nome de atuação pode existir em clusters diferentes, mas não dentro do mesmo cluster — a constraint de unicidade é composta por `(nome, id_cluster)`.

Na entidade, o Cluster tem `@OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)` para AtuacaoEspecifica — a única relação bidirecional do projeto. Isso permite que atuações sejam gerenciadas via cascata quando necessário.

O `GET /api/v1/atuacoes-especificas` (sem filtro de cluster) retorna todas as atuações paginado, para uso administrativo.

---

## 3 - Fluxo do Associado

Com equipe, cluster e atuação cadastrados, você pode registrar um associado via `POST /api/v1/associados` (requer `ROLE_ADM`). A entidade `Associado` é o centro de tudo — praticamente todos os outros módulos do sistema orbitam ao redor dela.

O request (`AssociadoRequestDto`) exige campos obrigatórios de dados pessoais (`nomeCompleto`, `cpf` 11 dígitos, `emailPrincipal`, `telefonePrincipal`, `dataNascimento`), campos administrativos (`dataIngresso`, `tipoOrigemEquipe`, `statusAssociado`), referências por ID (`idEquipe`, `idCluster`, `idAtuacaoEspecifica`, `idCargoLideranca`), e campos do primeiro endereço residencial embutidos (`rua`, `numero`, `complemento`, `bairro`, `cidade`, `estado` 2 chars, `cep` 8 dígitos).

O cadastro agora é mais rico que uma simples inserção. Na mesma transação `@Transactional`, o `AssociadoService.cadastrarAssociado` dispara a criação automática de três registros filhos sem necessidade de chamadas separadas:
1. **AssociadoVisibilidade**: com `exibirAniversario` vindo do request e `exibirEnderecoComercial = false` por padrão.
2. **AssociadoCargoLideranca**: com `idCargoLideranca` e `dataInicioCargo` do request, `ativo = true`.
3. **AssociadoEnderecoResidencial**: com os campos de endereço embutidos no request.

O associado sai do cadastro já completo nesses três eixos.

O campo `statusAssociado` usa o enum `StatusAssociado` com 7 valores: PREATIVO, ATIVO, INATIVO_PAUSA_PROGRAMADA, INATIVO_DESISTENCIA, INATIVO_FALECIMENTO, INATIVO_DESLIGADO, INATIVO_OUTRO. Todo associado novo começa como PREATIVO — nenhuma transição ocorre automaticamente. Para INATIVO_PAUSA_PROGRAMADA, o request exige `dataInicioPausa` e `dataPrevisaoRetorno`; o service valida que esses campos estejam presentes somente nesse status e ausentes nos demais.

O campo `dataVencimento` é calculado automaticamente: dia 01 do mês seguinte ao mês de ingresso, do ano seguinte. Exemplos: ingresso 10/02/2026 → vencimento 01/03/2027; ingresso 31/12/2025 → vencimento 01/01/2027. Se o associado tem cargo com `classificacaoFinanceira = ISENTO`, o vencimento é `null`.

O CPF é único e nunca pode ser alterado depois do cadastro. O e-mail também tem verificação de unicidade na edição, ignorando o próprio associado.

A edição via `PUT /api/v1/associados/{idAssociado}` (requer `ROLE_ADM`) permite alterar todos os campos mutáveis, inclusive trocar equipe, cluster e atuação — mas o CPF é bloqueado. O `atualizadoEm` é setado automaticamente com `LocalDateTime.now()`.

O `GET /api/v1/associados` lista todos os associados paginado. O `GET /api/v1/associados/{idAssociado}` retorna um associado específico com nomes resolvidos (equipe, cluster, atuação, padrinho, equipe de origem).

Além dos endpoints CRUD, o `AssociadosController` expõe:
- `PATCH /{idAssociado}/confirmar-cadastro` — transição PREATIVO → ATIVO (só ADM).
- `PATCH /{idAssociado}/renovar-anuidade` — descrito no Fluxo 14.
- `PATCH /{idAssociado}/alterar-status` — descrito no Fluxo 11.
- `GET /{idAssociado}/historico-status` — descrito no Fluxo 11.
- `GET /{cpf}/perfil` — retorna dados filtrados por perfil, descrito no Fluxo 16.
- `PUT /{cpf}/campo/{nomeCampo}` — edição campo a campo com auditoria, descrito no Fluxo 16.
- `POST /{cpf}/permissao/{campo}` — toggle de visibilidade, descrito no Fluxo 9.

---

## 4 - Fluxo de Endereços Residenciais

O primeiro endereço residencial é criado automaticamente durante o cadastro do associado (Fluxo 3), usando os campos de endereço embutidos no `AssociadoRequestDto`. Endereços adicionais podem ser registrados via `POST /api/v1/enderecos-residenciais/associado/{idAssociado}`.

Esse dado é obrigatório para geração de contrato, mas é sensível — nunca exibido para outros associados. Por isso vive em tabela separada, e não como campos dentro da própria tabela de associado. A relação é `@ManyToOne` — um associado pode ter múltiplos endereços cadastrados ao longo do tempo.

O service aplica `FormataString.primeiraLetraMaiuscula()` nos campos rua, bairro e cidade, e faz uppercase no estado.

A edição via `PUT /api/v1/enderecos-residenciais/{idEndereco}` permite atualizar um endereço existente. A consulta via `GET /api/v1/enderecos-residenciais/associado/{idAssociado}` retorna a lista completa de endereços do associado. Não existe endpoint de busca por ID individual — apenas por associado.

---

## 5 - Fluxo de Empresas

Todo associado C+C é também um empresário, então você cadastra a empresa dele via `POST /api/v1/empresas`. A entidade `Empresa` tem CNPJ único, razão social e nome fantasia — e carrega uma FK para o associado. O campo `cargo` foi removido conforme o PRD.

Os dados empresariais ficam separados dos dados pessoais porque o associado pode atualizar sua empresa sem tocar na identidade pessoal, e a visibilidade desses dados segue regras próprias.

Uma particularidade do `EmpresaService`: no `editarEmpresa`, se o request incluir campos de endereço (campo `rua` presente e não vazio), o service atualiza o endereço comercial existente ou cria um novo se não existir. Isso permite editar empresa e endereço comercial numa única chamada.

A edição via `PUT /api/v1/empresas/{idEmpresa}` verifica unicidade do CNPJ contra outras empresas, ignorando a própria. Você pode listar todas as empresas de um associado via `GET /api/v1/empresas/associado/{idAssociado}` (paginado) ou buscar uma específica via `GET /api/v1/empresas/{idEmpresa}`.

---

## 6 - Fluxo de Endereços Comerciais

Assim como o endereço residencial, o endereço do negócio vive em tabela separada e é cadastrado via `POST /api/v1/enderecos-comerciais`. A diferença filosófica é que o endereço comercial pode ser exibido para toda a rede mediante autorização do associado (controlado pelo toggle `exibirEnderecoComercial` do Fluxo 9) — é um dado profissional que potencializa conexões.

A FK está no lado do endereço (`empresa_id`), seguindo o mesmo padrão dos demais endereços do sistema. O service aplica `FormataString.primeiraLetraMaiuscula()` nos campos de rua, bairro, cidade e estado.

A busca via `GET /api/v1/enderecos-comerciais/empresa/{idEmpresa}` retorna o endereço vinculado à empresa. A relação é 1:1 na prática (um endereço por empresa). A edição via `PUT /api/v1/enderecos-comerciais/{idEnderecoComercial}` permite atualizar o endereço.

---

## 7 - Fluxo de Cargos de Liderança

Primeiro você cadastra o catálogo de cargos via `POST /api/v1/cargos-lideranca`. Esse endpoint cria a entidade `CargoLideranca` — que é a tabela de referência de todos os títulos que existem na rede C+C: Diretor de Equipe, HEAD, Gestor Administrativo, e assim por diante. Ela existe para que a ADM possa criar, renomear e inativar cargos sem precisar mexer no código.

Cada cargo tem três campos importantes:
- `classificacaoFinanceira` (enum `ClassificacaoFinanceira`: NORMAL ou ISENTO) — determina se o associado com esse cargo é isento de anuidade.
- `atribuicaoIsenta` (enum `AtribuicoesIsentas`, nullable) — especifica exatamente qual atribuição isenta é: DE_DIRETOR_DE_EQUIPE, DT3/DT2/DT1, DM3/DM2/DM1, ou ADM_CC_ADMINISTRACAO. Esse campo é usado no login para determinar se o perfil do associado é DIRETOR (os DE_, DT_ e DM_ são cargos de diretor).
- `ativo` (Boolean) — permite soft delete.

O nome do cargo é único e normalizado via `primeiraLetraMaiuscula()`. O `GET /api/v1/cargos-lideranca` retorna todos os cargos paginado, ordenado por nome.

Depois de ter o catálogo, você designa um cargo para um associado via `POST /api/v1/associados-cargos` (requer `ROLE_ADM`). Aqui entra a entidade `AssociadoCargoLideranca`. Diferente de como funciona a equipe no cadastro do associado — onde o vínculo é um campo direto — o cargo de liderança vive em uma tabela separada com `dataInicio`, `dataFim` e `ativo`. O motivo disso está no PRD: um associado pode acumular mais de um cargo ao longo do tempo e pode ter cargos simultâneos.

O service verifica duplicidade ativa: se o mesmo associado já tem o mesmo cargo ativo (não importa a equipe), lança `RegraNegocioException`. Na edição, essa verificação só ocorre se o cargo está sendo alterado (para permitir editar a data sem conflitar consigo mesmo).

O `PUT /api/v1/associados-cargos/{idAssociadoCargo}` (requer `ROLE_ADM`) permite encerrar ou alterar uma designação. O `GET /api/v1/associados-cargos/associado/{idAssociado}` retorna todos os cargos de um associado. O `GET /api/v1/associados-cargos/cargo/{idCargoLideranca}` retorna todos os associados que ocupam determinado cargo. Todos os endpoints de cargo exigem `ROLE_ADM`.

---

## 8 - Fluxo de Grupamentos Estratégicos

Primeiro você cadastra o grupamento via `POST /api/v1/grupamentos`. A entidade `GrupamentoEstrategico` tem `nomeGrupamento`, `sigla` (2 a 4 caracteres, convertida para uppercase e trimada) e `ativo`. O nome é normalizado via `primeiraLetraMaiuscula()`.

Os Grupamentos são camadas transversais criadas pela ADM para unir associados de clusters diferentes em torno de um tema de mercado em comum. Um associado de Tecnologia e um de Construção Civil podem estar juntos no grupamento CIVL se ambos atuam no mercado de construção. O Grupamento não substitui o Cluster, ele complementa.

A validação de unicidade é dupla: o service verifica tanto o nome quanto a sigla contra grupamentos existentes. Na edição, ambas as verificações ignoram o próprio grupamento.

O `GET /api/v1/grupamentos` retorna todos os grupamentos paginado, ordenado por nome.

Depois, você vincula um associado a um grupamento via `POST /api/v1/associados-grupamentos`. A entidade `AssociadoGrupamento` tem a mesma filosofia do cargo: tabela própria com vigência (`dataInicio`, `dataFim`, `ativo`). O motivo também é parecido — um associado pode pertencer a mais de um grupamento simultaneamente, e essa vinculação tem início e pode ter fim.

As consultas funcionam nos dois sentidos: `GET /api/v1/associados-grupamentos/associado/{idAssociado}` mostra todos os grupamentos de um associado, e `GET /api/v1/associados-grupamentos/grupamento/{idGrupamento}` mostra todos os associados de um grupamento. A edição via `PUT /api/v1/associados-grupamentos/{idAssociadoGrupamento}` permite encerrar ou alterar a vinculação. O `GET /api/v1/associados-grupamentos/{idAssociadoGrupamento}` busca um vínculo específico por ID.

---

## 9 - Fluxo de Visibilidade do Associado

O registro de visibilidade nasce automaticamente junto com o associado — o `AssociadoService` cria um `AssociadoVisibilidade` na mesma transação do cadastro, com os valores `exibirAniversario` vindo do request e `exibirEnderecoComercial = false` por padrão. Por isso não existe `POST` neste controller — criar manualmente seria duplicar um dado que já existe (embora o service de visibilidade tenha o método `cadastrarVisibilidade` que verifica unicidade e lança `JaCadastradoException` se já existir).

O que fica exposto são apenas consulta e edição. Você busca a visibilidade de um associado via `GET /api/v1/visibilidades/associado/{idAssociado}` ou diretamente pelo ID via `GET /api/v1/visibilidades/{idVisibilidade}`. A edição via `PUT /api/v1/visibilidades/{idVisibilidade}` permite ao associado controlar o que fica público para a rede: o dia e mês do aniversário (`exibirAniversario`) e o endereço comercial (`exibirEnderecoComercial`).

Essas flags são consultadas pelo APP para montar o perfil público do associado — dados que o próprio usuário controla. A lógica de visibilidade do endereço comercial é centralizada aqui, e não na entidade Empresa — consolidação explicitada no GAP 8 do PRD.

O toggle de visibilidade também pode ser feito via `POST /api/v1/associados/{cpf}/permissao/{campo}` no `AssociadosController`. Esse endpoint inverte o boolean correspondente: "aniversarioDiaMes" alterna `exibirAniversario`, "enderecoComercial" alterna `exibirEnderecoComercial`. Para ASSOCIADO, só é permitido alterar o próprio CPF; ADM_CC pode alterar qualquer CPF.

---

## 10 - Fluxo de Estrutura Organizacional da Equipe

Este fluxo cobre cinco módulos que juntos descrevem a estrutura interna de uma equipe. Todos dependem de uma equipe já cadastrada (Fluxo 1) para funcionar.

**Local Presencial** (`POST /api/v1/locais-presenciais`): registra o endereço estruturado completo onde a equipe realiza suas reuniões presenciais. O mapper aplica `primeiraLetraMaiuscula()` em rua, bairro, cidade e converte UF para uppercase. A busca `GET /api/v1/locais-presenciais/equipe/{idEquipe}` retorna o local vinculado a uma equipe específica. O APP usa esse dado para exibir o endereço ao associado nas semanas em que a reunião é presencial (1ª e 3ª ocorrências do dia da semana no mês). A edição via `PUT /api/v1/locais-presenciais/{idLocalPresencial}` permite atualizar o local. O `GET /api/v1/locais-presenciais/{idLocalPresencial}` busca por ID.

**Diretor de Território** (`POST /api/v1/diretores-territorio`): vincula um associado como Diretor de Território de uma equipe, com `dataInicio` obrigatória e `dataFim` opcional (null = vigência indeterminada). O request recebe `idEquipe` e `idAssociado`, e o service resolve as entidades. A busca `GET /api/v1/diretores-territorio/equipe/{idEquipe}` retorna o histórico completo de diretores de território daquela equipe. A edição via `PUT /api/v1/diretores-territorio/{idDiretorTerritorio}` permite encerrar ou substituir uma designação. O `GET /api/v1/diretores-territorio/{idDiretorTerritorio}` busca por ID.

**Diretor de Equipe** (`POST /api/v1/diretores-equipe`): funciona de forma idêntica ao Diretor de Território, mas para o cargo de Diretor de Equipe. A separação em tabelas distintas é intencional — cada cargo tem sua própria linha do tempo independente. A busca `GET /api/v1/diretores-equipe/equipe/{idEquipe}` retorna o histórico completo. O `GET /api/v1/diretores-equipe/{idDiretorEquipe}` busca por ID.

**Cargo Ativo de Equipe** (`POST /api/v1/equipes-cargos-ativos`, requer `ROLE_ADM`): vincula um cargo do catálogo (`CargoLideranca`) a uma equipe — define quais cargos existem naquela equipe. A constraint `UniqueConstraint(equipe_id, cargo_lideranca_id)` impede duplicidade; se já existe, lança `JaCadastradoException`. O `PUT /api/v1/equipes-cargos-ativos/{id}` (requer `ROLE_ADM`) permite ativar/desativar. O `GET /api/v1/equipes-cargos-ativos/equipe/{idEquipe}` retorna todos os cargos (ativos e inativos, ordenados por `criadoEm` desc). O `GET /api/v1/equipes-cargos-ativos/equipe/{idEquipe}/ativos` retorna apenas os ativos.

**Designação de Liderança** (`POST /api/v1/designacoes-lideranca`): vincula qualquer cargo do catálogo a um associado dentro de uma equipe, com vigência. É o módulo mais flexível — serve para qualquer cargo que a ADM queira designar formalmente: HEAD, Gestor Administrativo, Coordenador de Visitantes, etc. O service verifica duplicidade ativa antes de criar: se o mesmo associado já tem o mesmo cargo ativo na mesma equipe (com `dataFim = null`), lança `RegraNegocioException`. A busca `GET /api/v1/designacoes-lideranca/equipe/{idEquipe}` retorna todas as designações da equipe, ativas e encerradas. O `PUT /api/v1/designacoes-lideranca/{idDesignacao}` permite encerrar ou alterar.

**Pontuação por Faixa** (`POST /api/v1/pontuacao-faixas`): tabela de configuração global (sem FK para nenhuma equipe específica) que define quanto ponto uma equipe ganha por mês dependendo do número de associados ativos que possui. Os valores padrão do PRD são 15–24 = 20 pts, 25–34 = 22 pts, e assim por diante até 65+ = 30 pts (campo `maximoAssociados = null` indica faixa aberta para cima).

A validação de sobreposição é a regra de negócio mais elaborada deste módulo: ao cadastrar ou editar, o service verifica se o novo intervalo `[min, max]` não se sobrepõe a nenhuma faixa existente. A lógica: duas faixas `[a,b]` e `[c,d]` se sobrepõem quando `a <= d AND c <= b` (com tratamento especial para `null` = sem limite). Na edição, ignora a própria faixa. A ADM pode cadastrar, editar e inativar faixas livremente — alterações não retroagem no histórico.

O `GET /api/v1/pontuacao-faixas/ativas` retorna apenas as faixas vigentes. O `GET /api/v1/pontuacao-faixas` retorna todas, inclusive inativas.

---

## 11 - Fluxo de Status e Histórico do Associado

Este fluxo desacopla a mudança de status do endpoint genérico de edição do associado, criando um canal dedicado com rastreabilidade completa. Toda mudança de status é exclusividade da ADM — nenhuma transição ocorre automaticamente.

**Mudança de status** (`PATCH /api/v1/associados/{idAssociado}/alterar-status`, requer `ROLE_ADM`): recebe `statusNovo`, `motivo`, `dataInicioPausa`, `dataPrevisaoRetorno` e `idRegistradoPor`. O service aplica as regras de negócio antes de persistir:

- Para `INATIVO_DESISTENCIA` e `INATIVO_DESLIGADO`: campo `motivo` é obrigatório.
- Para `INATIVO_PAUSA_PROGRAMADA`: campos `dataInicioPausa` e `dataPrevisaoRetorno` são obrigatórios.
- Para `INATIVO_FALECIMENTO`: dispara `AlertaSeguroFuneralEvent` via `ApplicationEventPublisher`.
- Ao sair da pausa programada para qualquer outro status: campos de pausa são limpos automaticamente no associado.

Após validação, o service executa dois saves dentro da mesma transação: atualiza os campos de status no `Associado` e cria um registro imutável em `AssociadoStatusHistorico`. O endpoint retorna o DTO do histórico criado, não o associado atualizado — isso deixa claro que a resposta é o comprovante da operação.

O campo `idRegistradoPor` recebe o ID do `Usuario` que está realizando a mudança. O `registradoEm` é preenchido via `@PrePersist`.

**Detalhe importante sobre dados de pausa**: `dataInicioPausa` e `dataPrevisaoRetorno` existem em AMBAS tabelas. No `Associado` = estado atual (mutável, vira NULL quando pausa termina). No `AssociadoStatusHistorico` = snapshot imutável, preserva o histórico de todas as pausas que já ocorreram.

**Histórico de status** (`GET /api/v1/associados/{idAssociado}/historico-status`): retorna a linha do tempo completa em ordem decrescente (`registradoEmDesc`). Cada entrada traz `statusAnterior`, `statusNovo`, `motivo`, datas de pausa quando aplicável, e nome do usuário registrador. O histórico é imutável por design — sem endpoint de edição ou exclusão.

---

## 12 - Fluxo de Perfil do Associado

O perfil é a identidade pública do associado dentro da rede C+C. Enquanto a entidade `Associado` guarda os dados operacionais e administrativos, o `PerfilAssociado` guarda o que o associado quer mostrar para os outros membros.

**Criação do perfil** (`POST /api/v1/perfis`): um associado só pode ter um perfil — o service verifica a unicidade via `existsByAssociado_IdAssociado` antes de criar, lançando `JaCadastradoException` se já existir. Diferente do endereço residencial e da visibilidade (criados automaticamente no cadastro), o perfil é criado explicitamente pelo associado no primeiro acesso ao APP — o PRD define isso como a "Fase 3".

Campos do perfil são divididos em dois grupos:

**Grupo 1 — Preenchido manualmente** pelo próprio associado: `fotoProfissional`, `nomeProfissional` (max 40), `nomeEmpresa` (max 80), `logomarcaEmpresa`, `telefonePrincipal` (max 20), `telefoneSecundario` (max 20), `email` (max 60), `site` (max 60), `linkedIn` (max 60), `instagram` (max 60), `youTube` (max 60), `outraRedeSocial` (max 60), `oQueFaco` (max 200), `publicoIdeal` (max 150), `principalProblemaResolvo` (max 200), `conexoesEstrategicas` (max 150), `interessesPessoais` (max 200).

**Grupo 2 — Automático**: cluster, atuação específica, equipe, status, data de ingresso e data de vencimento são resolvidos em tempo de consulta diretamente da entidade `Associado`, sem duplicar dados no banco. O cargo ativo atual (`nomeCargoAtual`) é resolvido via query dedicada no `AssociadoCargoLiderancaRepository` — `findFirstByAssociado_IdAssociadoAndAtivoTrueOrderByDataInicioDesc`.

A separação no mapper é intencional: `PerfilAssociadoMapper.toResponse` recebe a entidade do perfil + `nomeCargoAtual` como parâmetro separado. Os demais campos automáticos são acessados via lazy loading.

**Edição do perfil** (`PUT /api/v1/perfis/{idPerfil}`): atualiza todos os campos editáveis. O `idAssociado` no request durante edição é ignorado para o vínculo.

**Flag `perfilCompleto`**: calculado automaticamente após cada save. O método privado `atualizarFlagPerfilCompleto` verifica se todos os 10 campos obrigatórios estão preenchidos e não em branco: `fotoProfissional`, `nomeProfissional`, `nomeEmpresa`, `telefonePrincipal`, `email`, `oQueFaco`, `publicoIdeal`, `principalProblemaResolvo`, `conexoesEstrategicas` e `interessesPessoais`. Whitespace-only conta como em branco. O APP usa esse flag para saber se pode exibir o perfil completo na listagem.

Busca disponível via `GET /api/v1/perfis/{idPerfil}` e `GET /api/v1/perfis/associado/{idAssociado}` — o segundo é o mais usado pelo APP.

---

## 13 - Fluxo de Anuidades

Este fluxo controla o pagamento anual dos associados. A ADM cadastra a anuidade de cada associado por ano de referência.

**Cadastro** (`POST /api/v1/associados-anuidades`, requer `ROLE_ADM`): o request recebe `idAssociado`, `anoReferencia`, `statusAnuidade` (enum: AGUARDANDO, PAGO ou ISENTO), `dataPagamento`, `valorPago` e `observacao` (max 200 chars). A unicidade é por `(associado + anoReferencia)` — não pode existir duas anuidades para o mesmo associado no mesmo ano, lança `JaCadastradoException`.

Regra de negócio principal: se o status for PAGO, o campo `dataPagamento` é obrigatório — sem ele, lança `RegraNegocioException`. Para AGUARDANDO e ISENTO, `dataPagamento` é opcional.

**Edição** (`PUT /api/v1/associados-anuidades/{idAnuidade}`, requer `ROLE_ADM`): permite alterar status, data de pagamento, valor e observação. Aplica as mesmas regras de validação do cadastro.

**Consultas**: `GET /api/v1/associados-anuidades/{idAnuidade}` retorna uma anuidade específica. `GET /api/v1/associados-anuidades/associado/{idAssociado}` retorna todas as anuidades do associado, ordenadas por ano de referência decrescente.

A entidade `AssociadoAnuidade` usa `@PrePersist` e `@PreUpdate` para preencher `criadoEm` e `atualizadoEm` automaticamente.

---

## 14 - Fluxo de Renovação de Anuidade

A renovação é um processo específico que estende o vencimento do associado em 12 meses. Diferente da anuidade (que rastreia o pagamento por ano), a renovação altera o `dataVencimento` do associado e gera um registro imutável de auditoria.

**Renovação** (`PATCH /api/v1/associados/{idAssociado}/renovar-anuidade`, requer `ROLE_ADM`): o request é o `RenovacaoAnuidadeRequestDto` com apenas `dataPagamento` (obrigatória, `@PastOrPresent`).

O service aplica validações antes de prosseguir:
- Associado PREATIVO não pode renovar (precisa confirmar cadastro antes).
- Associado com cargo ISENTO não pode renovar (não tem vencimento).
- Associado sem `dataPagamentoPrimeiraAnuidade` registrada não pode renovar.

Se tudo passar, o service: salva o `dataVencimento` anterior, calcula o novo como `dataVencimento + 12 meses`, atualiza o campo no associado, e cria automaticamente um registro `AssociadoRenovacao` com `dataVencimentoAnterior`, `dataVencimentoNova`, `dataPagamento` e `registradoPor`. O método é anotado com `@RequiresLog`, gerando log de auditoria via `AuditoriaAspect`.

**Consulta de renovações** (`GET /api/v1/associados-renovacoes/associado/{idAssociado}`): retorna o histórico completo de renovações do associado, ordenado por `registradoEm` decrescente. Este é o único endpoint do `AssociadoRenovacaoController` — não existe criação manual de renovação porque ela é sempre gerada automaticamente pelo processo de renovação.

---

## 15 - Fluxo de Pagamentos (Stripe)

O sistema integra com a API do Stripe para processar pagamentos via PIX, Boleto ou Cartão de Crédito. A integração usa o `stripe-java:25.1.0` e suporta ambiente de mock local via Docker.

**Produto** (`/api/produtos`): a entidade `Produto` armazena `nome`, `descricao`, `valor` (BigDecimal), `ativo` (Boolean), `stripeProdutoId` e `stripePrecoId`. O `POST /api/produtos` cria o produto localmente E no Stripe (Product + Price) numa única operação — o service converte o valor para centavos (x100) antes de enviar ao Stripe. O `DELETE /api/produtos/{id}` é soft delete (seta `ativo = false`, não remove).

**Checkout** (`POST /api/produtos/checkout`): recebe `stripePrecoId`, `clienteEmail`, `nomeCompleto`, `cpf`, `metodoPagamento` ("pix", "boleto" ou "card") e `parcelas`. Cria uma Stripe Checkout Session com os parâmetros. Para cartão com mais de 1 parcela, configura installments com `fixed_count`. Metadados `nome_completo` e `cpf` são embutidos na sessão. URLs de sucesso/cancelamento apontam para `localhost:4200`.

**Pagamento direto** (`POST /api/produtos/pagar`): recebe `stripePrecoId` e `paymentMethodId`. Cria um `PaymentIntent` com confirmação imediata (`confirm = true`). Retorna status ("succeeded", "requires_action"), `transacaoId` e valor.

**Webhook** (`POST /webhook/stripe`): recebe eventos do Stripe e valida a assinatura. Trata 3 tipos de evento: `payment_intent.succeeded` (log de sucesso), `payment_intent.payment_failed` (log de falha) e `checkout.session.completed` (log de conclusão). Eventos desconhecidos são ignorados.

**Infraestrutura Docker**: O `docker-compose.yml` levanta `stripe-mock` (porta 12111/12112) para simular a API do Stripe localmente, e `stripe-cli` para monitorar e disparar webhooks. A `StripeConfig` inicializa o SDK com `stripe.api.base-url` apontando para o mock.

---

## 16 - Fluxo de Visibilidade por Campo e Edição Granular

Este fluxo é transversal — não tem tabela própria, mas implementa o sistema de permissões campo a campo que o PRD exige.

**Mecanismo**: a anotação `@Visibilidade(leitura, edicao, condicional)` é aplicada em cada campo do `AssociadoViewDto`. O `VisibilidadeFiltroService` usa reflection para filtrar dinamicamente quais campos são visíveis para cada perfil:

- **ADM_CC**: vê todos os campos, incluindo condicionais com boolean=false. Vê todos os status (inclusive INATIVO_DESISTENCIA, INATIVO_FALECIMENTO, INATIVO_DESLIGADO).
- **ASSOCIADO (próprio perfil)**: vê dados pessoais. NÃO vê cpfPadrinho, dataPrimeiraPagamento, cargoLiderancaTipo (classificação financeira). Vê aniversarioDiaMes e enderecoComercial mesmo com boolean=false (é o próprio dado). NÃO vê status INATIVO_DESISTENCIA/FALECIMENTO/DESLIGADO do próprio perfil.
- **ASSOCIADO (perfil alheio)**: vê apenas campos REDE_CC. Campos condicionais (aniversarioDiaMes, enderecoComercial) respeitam os booleans de toggle. NÃO vê status restritos.
- **DIRETOR**: vê campos REDE_CC como qualquer membro. NÃO vê cpfPadrinho nem status INATIVO_DESLIGADO.

**Consulta filtrada** (`GET /api/v1/associados/{cpf}/perfil`): o `AssociadosController` monta o `AssociadoViewDto` via `buildViewDto`, passa pelo `VisibilidadeFiltroService.filtrar()` com o perfil do usuário autenticado, e retorna um `Map<String, Object>` com apenas os campos permitidos.

**Edição campo a campo** (`PUT /api/v1/associados/{cpf}/campo/{nomeCampo}`): antes de aceitar a edição, o service chama `validarPermissaoEdicao()` que verifica se o perfil do usuário está listado no array `edicao[]` da `@Visibilidade` daquele campo. Se não estiver, lança `AccessDeniedException`. O método `editarCampo` é anotado com `@RequiresLog`, gerando log de auditoria com valor anterior e novo.

---

## 17 - Fluxo de Auditoria (AOP)

A auditoria é implementada via AspectJ com a anotação `@RequiresLog` e o `AuditoriaAspect`. É transversal a todo o sistema.

O aspecto intercepta métodos anotados com `@RequiresLog` e executa antes e depois. Ele captura o responsável pela ação usando múltiplas estratégias em cascata: primeiro tenta `UsuarioAutenticado.details` do SecurityContext (CPF ou Perfil), depois a entidade `Usuario` principal (extrai do associado vinculado ou email para ADM), e como último recurso o `Authentication.name`.

Os argumentos do método interceptado são extraídos por convenção posicional: índice 2 = `valorAnterior`, índice 3 = `valorNovo`. O aspecto cria um registro `LogAlteracao` com: entidade, campo alterado, valor anterior, valor novo, CPF do responsável e timestamp.

A entidade `LogAlteracao` é imutável — apenas INSERT, sem UPDATE nem DELETE. O repository oferece consultas por entidade+campo (ordenado por hora desc) e por CPF do responsável (ordenado por hora desc).

Métodos que usam `@RequiresLog` atualmente: `alterarStatus`, `renovarAnuidade`, `editarCampo`.

---

## 18 - Fluxo de Docker e Infraestrutura

O projeto usa Docker com multi-stage build e Docker Compose para orquestrar 4 serviços:

**Dockerfile**: Stage 1 (Maven) compila o projeto. Stage 2 (Eclipse Temurin JDK 21) roda o JAR. O `.dockerignore` exclui .git, .idea, target/, logs/, .env.

**docker-compose.yml** — 4 serviços:
- **postgres** (postgres:16-alpine, porta 5432): banco de dados. Credenciais: postgres/bh@scara, database: db_admcc.
- **stripe-mock** (stripe/stripe-mock:latest, portas 12111/12112): simula a API do Stripe para desenvolvimento local.
- **stripe-cli** (stripe/stripe-cli:latest): monitora e dispara webhooks do Stripe para a API.
- **api** (gerenciamento:0.0.1-SNAPSHOT, porta 8080): aplicação Spring Boot. Variáveis de ambiente: SPRING_DATASOURCE_URL apontando para o container postgres, JWT_SECRET, ADMIN_EMAIL/ADMIN_SENHA, STRIPE_API_KEY (sk_test_123), STRIPE_API_BASE_URL (http://stripe-mock:12111).

Comandos: `docker-compose up -d --build` (subir), `docker-compose logs -f api` (logs), `docker-compose down` (parar), `docker-compose down -v` (limpar volumes).
