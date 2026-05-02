import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
 
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { formatarEnderecoResidencial } from '../../../helpers/endereco.helper';
import { gerarPdfAssociado } from '../../../helpers/pdf-associado.helper';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import {
  AssociadoAlterarStatusRequestDto,
  AssociadoEditarEquipeRequestDto,
  AssociadoRequestDto,
  AssociadoResponseDto,
  AssociadoRenovarAnuidadeRequestDto,
  AssociadoVisibilidadeResponseDto,
  EnderecoResidencialRequestDto,
  EnderecoResidencialResponseDto,
  LABELS_STATUS_ASSOCIADO,
  STATUS_ASSOCIADO_OPCOES,
  StatusAssociado,
} from '../../../models/associado.model';
import { AtuacaoEspecificaResponseDto, ClusterResponseDto } from '../../../models/cluster.model';
import { CargoLiderancaResponseDto } from '../../../models/cargo-lideranca.model';
import {
  AssociadoCargoLiderancaRequestDto,
  AssociadoCargoLiderancaResponseDto,
} from '../../../models/associado-cargo.model';
import { EquipeResponseDto } from '../../../models/equipe.model';
import { AuthService } from '../../../core/auth/auth.service';
import { AssociadoService } from '../../../services/associado.service';
import { AssociadoCargoService } from '../../../services/associado-cargo.service';
import { CargoLiderancaService } from '../../../services/cargo-lideranca.service';
import { ClusterService } from '../../../services/cluster.service';
import { EquipeService } from '../../../services/equipe.service';
import { ToastService } from '../../../services/toast.service';
import { EmpresaService } from '../../../services/empresa.service';
import {
  EmpresaCadastroRequestDto,
  EmpresaEnderecoComercialRequestDto,
  EmpresaRequestDto,
  EmpresaResponseDto,
} from '../../../models/empresa.model';
import { AssociadoAnuidadeService } from '../../../services/associado-anuidade.service';
import { AssociadoGrupamentoService } from '../../../services/associado-grupamento.service';
import { PerfilAssociadoService } from '../../../services/perfil-associado.service';
import { AssociadoGrupamentoResponseDto } from '../../../models/associado-grupamento.model';
import {
  AssociadoAnuidadeResponseDto,
  AssociadoRenovacaoResponseDto,
} from '../../../models/associado-anuidade.model';
import { PerfilAssociadoResponseDto } from '../../../models/perfil-associado.model';

// ============================================================================
// SHIM DE TIPO — bootstrap (global JS carregado via angular.json)
//
// O bundle bootstrap.bundle.min.js é importado no angular.json como script
// global, então `bootstrap` existe em runtime como `window.bootstrap`. Não
// instalamos @types/bootstrap; declaramos apenas o contrato mínimo necessário:
// Modal.getOrCreateInstance(el).show()/hide(). Mesmo padrão de equipes.ts.
// ============================================================================
declare const bootstrap: {
  Modal: {
    getOrCreateInstance(el: Element): { show(): void; hide(): void };
  };
};

// ============================================================================
// VALIDADOR CUSTOMIZADO — Data não pode ser futura
//
// Definido fora da classe para evitar problemas de contexto (this) quando
// passado como referência ao FormBuilder. Puro — sem efeitos colaterais.
// ============================================================================
function validarDataNaoFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  // Sufixo T00:00:00 garante comparação em horário local (evita off-by-one por fuso)
  const data = new Date(control.value + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data > hoje ? { dataFutura: true } : null;
}

// ============================================================================
// VALIDADOR CUSTOMIZADO — Idade mínima de 16 anos
//
// Calcula o limite subtraindo 16 anos da data atual.
// Ex: hoje = 28/04/2026 → limite = 28/04/2010.
// Datas posteriores ao limite (nascidos após 28/04/2010) são inválidas.
// Mesmo padrão de validarDataNaoFutura: função pura fora da classe para
// evitar ambiguidade de contexto (this) ao passar como referência ao FormBuilder.
// ============================================================================
function validarIdadeMinima16Anos(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const data  = new Date(control.value + 'T00:00:00');
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 16);
  limite.setHours(0, 0, 0, 0);
  return data > limite ? { idadeMinima: true } : null;
}

/**
 * ASSOCIADOS PAGE COMPONENT
 *
 * Página de listagem e gerenciamento de associados.
 *
 * Segue CLAUDE.md SEÇÃO 4 (Componente burro):
 * - Exibe dados vindos do Service
 * - Captura ações do usuário (filtros, cliques, submit)
 * - Delega toda lógica ao Service (sem HTTP direto)
 *
 * Blocos implementados:
 *   Bloco 2: Listagem paginada com filtros e KPI cards
 *   Bloco 3: Modal de cadastro de novo associado (este arquivo)
 *   Bloco 4+: Modal de edição e ações rápidas (próximos blocos)
 */
@Component({
  selector: 'app-associados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './associados.html',
  styleUrl: './associados.css',
})
export class Associados implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private authService           = inject(AuthService);
  private associadoService      = inject(AssociadoService);
  private associadoCargoService = inject(AssociadoCargoService);
  private equipeService         = inject(EquipeService);
  private cargoService          = inject(CargoLiderancaService);
  private clusterService        = inject(ClusterService);
  private toastService          = inject(ToastService);
  private empresaService             = inject(EmpresaService);
  private associadoAnuidadeService   = inject(AssociadoAnuidadeService);
  private associadoGrupamentoService = inject(AssociadoGrupamentoService);
  private perfilAssociadoService     = inject(PerfilAssociadoService);
  private fb                         = inject(FormBuilder);
  private destroyRef            = inject(DestroyRef);

  // =========================================================================
  // VIEWCHILD — referências aos botões ocultos que fecham os modais
  //
  // Por que ViewChild em vez de document.getElementById?
  // CLAUDE.md §2.2 proíbe manipulação direta do DOM no componente.
  // ViewChild é a forma Angular idiomática de referenciar elementos do template.
  // =========================================================================

  @ViewChild('btnFecharModalNovoAssociado')
  private btnFecharCadastro!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEdicao')
  private btnFecharEdicao!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalEquipe')
  private btnFecharEquipe!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalConfirmacao')
  private btnFecharConfirmacao!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalAlterarStatus')
  private btnFecharAlterarStatus!: ElementRef<HTMLButtonElement>;

  @ViewChild('btnFecharModalRenovar')
  private btnFecharRenovar!: ElementRef<HTMLButtonElement>;

  /**
   * Referência ao elemento DOM do modal de cargos.
   * Aberto programaticamente via bootstrap.Modal.getOrCreateInstance(el).show()
   * porque abrirModalCargo() precisa fazer um forkJoin de GETs antes de exibir
   * o modal. Mesmo padrão de modalEmpresaRef.
   */
  @ViewChild('modalCargosAssociado')
  private modalCargosRef!: ElementRef<HTMLElement>;

  /**
   * Referência ao elemento DOM do modal de endereço.
   * Aberto programaticamente após o GET inicial concluir — mesmo padrão de
   * modalCargosRef e modalEmpresaRef. Em caso de erro o modal não abre,
   * usuário recebe toast.
   */
  @ViewChild('modalEnderecoAssociado')
  private modalEnderecoRef!: ElementRef<HTMLElement>;

  /**
   * Referência ao elemento DOM do modal de confirmação de encerramento de cargo.
   * Aberto via bootstrap.Modal.getOrCreateInstance(el).show() para evitar
   * race condition de backdrop duplo ao empilhar sobre o modal de cargos.
   */
  @ViewChild('modalConfirmarEncerramentoCargo')
  private modalConfirmarEncerramentoCargo!: ElementRef<HTMLElement>;

  /** Botão oculto para fechar o modal de confirmação de encerramento via ViewChild. */
  @ViewChild('btnFecharModalConfirmacaoCargo')
  private btnFecharConfirmacaoCargo!: ElementRef<HTMLButtonElement>;

  /**
   * Botão oculto para fechar o modal de empresa via ViewChild.
   * Usado nos fluxos de sucesso de salvarEmpresa() — evita document.querySelector.
   */
  @ViewChild('btnFecharModalEmpresa')
  private btnFecharEmpresa!: ElementRef<HTMLButtonElement>;

  /**
   * Referência ao elemento DOM do modal de empresa.
   * Aberto programaticamente via bootstrap.Modal.getOrCreateInstance(el).show()
   * porque abrirModalEmpresa() precisa fazer um GET antes de exibir o modal
   * (determinar modo cadastro vs. edição). Mesmo padrão de modalConfirmarEncerramentoCargo.
   */
  @ViewChild('modalEmpresaAssociado')
  private modalEmpresaRef!: ElementRef<HTMLElement>;

  /**
   * Referência ao elemento DOM do modal de informações (Bloco 7).
   * Aberto programaticamente via forkJoin — garante que todos os dados
   * secundários estejam carregados antes de exibir o modal.
   */
  @ViewChild('modalInformacoesAssociado')
  private modalInfoRef!: ElementRef<HTMLElement>;

  /**
   * Referência ao elemento DOM do submodal de edição de dados pessoais (Tarefa 7.3).
   * Empilhado sobre o modal de informações — mesmo padrão do modal de confirmação
   * de encerramento de cargo sobre o modal de cargos.
   */
  @ViewChild('modalEditarDadosPessoais')
  private modalEditarDadosPessoaisRef!: ElementRef<HTMLElement>;

  /** Botão oculto para fechar o submodal de edição de dados pessoais via ViewChild. */
  @ViewChild('btnFecharModalEditarDadosPessoais')
  private btnFecharModalEditarDadosPessoais!: ElementRef<HTMLButtonElement>;

  // =========================================================================
  // SIGNALS — LISTAGEM
  // =========================================================================

  termoBusca      = signal('');
  filtroStatus    = signal<StatusAssociado | 'Todos'>('Todos');
  filtroEquipeId  = signal<number | null>(null);
  associados      = signal<AssociadoResponseDto[]>([]);
  equipes         = signal<EquipeResponseDto[]>([]);
  totalAssociados = signal(0);
  carregandoLista = signal(false);


  /**
   * buscaSubject
   *
   * Intermediário RxJS para debounce da busca por texto.
   * Cada tecla emite para o subject; o pipe debounceTime(400) só
   * dispara a chamada ao backend 400ms depois da última tecla.
   * Evita uma requisição por keystroke em campos de texto livre.
   */
  private readonly buscaSubject = new Subject<string>();

  // =========================================================================
  // SIGNALS — PAGINAÇÃO
  // =========================================================================

  /** Página zero-based enviada ao backend. */
  paginaAtual   = signal(0);
  tamanhoPagina = signal(20);

  /** Total de páginas retornado pelo backend. */
  totalPaginas  = signal(0);

  /** Flags que espelham hasNext / hasPrevious do backend. */
  temProxima  = signal(false);
  temAnterior = signal(false);

  // =========================================================================
  // SIGNALS — MODAL DE CADASTRO (Bloco 3)
  // =========================================================================

  /** Controla o spinner do botão "Cadastrar Associado" durante o POST. */
  carregandoModal      = signal(false);

  /**
   * Controla o spinner que substitui o formulário enquanto o forkJoin
   * carrega equipes, clusters e cargos de liderança.
   */
  carregandoDadosModal = signal(false);

  /** Mensagem de erro exibida no rodapé do modal (acima dos botões). */
  erroModal            = signal<string | null>(null);

  /**
   * Erros por campo retornados pelo backend (400 com objeto errors).
   * Chave = nome do campo Java (ex: 'cpf'), valor = mensagem.
   * Exibidos inline abaixo de cada input no template.
   */
  errosValidacao       = signal<Record<string, string>>({});

  // =========================================================================
  // SIGNALS — MODAL DE CARGO (Bloco 4)
  //
  // Gerencia a abertura do modal de atribuição de cargos por associado.
  // O associadoParaCargo guarda a linha clicada na tabela — é a fonte de
  // verdade para o idAssociado enviado no POST.
  // =========================================================================

  /**
   * associadoParaCargo
   * Associado da linha clicada. Exposto ao template para exibir o nome
   * no título do modal. Null enquanto nenhum modal estiver aberto.
   */
  associadoParaCargo = signal<AssociadoResponseDto | null>(null);

  /**
   * cargosDoAssociado
   * Lista de AssociadoCargoLiderancaResponseDto carregada via
   * GET /api/v1/associados-cargos/associado/{id} ao abrir o modal.
   * Inclui ativos e histórico (ativo: false com dataFim preenchida).
   */
  cargosDoAssociado = signal<AssociadoCargoLiderancaResponseDto[]>([]);

  /**
   * Controla o spinner do botão de cargos na tabela enquanto o forkJoin inicial
   * roda — antes do modal ser aberto. Mesmo padrão de carregandoVerificarEmpresa.
   */
  carregandoVerificarCargos = signal(false);

  /** Controla o spinner do botão "Atribuir Cargo" durante o POST. */
  carregandoModalCargo = signal(false);

  /** Mensagem de erro exibida no rodapé do modal de cargo. */
  erroModalCargo = signal<string | null>(null);

  /**
   * errosValidacaoCargo
   * Erros por campo retornados pelo backend (400).
   * Mesma estratégia do modal de cadastro: normaliza chaves aninhadas.
   */
  errosValidacaoCargo = signal<Record<string, string>>({});

  /**
   * cargoParaEncerrar
   * Cargo selecionado para encerramento. Preenchido em prepararEncerramentoCargo()
   * ao clicar no botão encerrar — fonte de verdade para o PUT em encerrarCargo().
   * Null enquanto nenhuma confirmação estiver pendente.
   */
  cargoParaEncerrar = signal<AssociadoCargoLiderancaResponseDto | null>(null);

  /**
   * encerrandoCargoId
   * Armazena o idAssociadoCargo cujo PUT de encerramento está em andamento.
   * Usado para exibir spinner e desabilitar o botão "Confirmar" no modal
   * enquanto a requisição está pendente.
   */
  encerrandoCargoId = signal<number | null>(null);

  /**
   * formCargo
   * Formulário do modal de cargo — apenas dois campos:
   * idCargoLideranca (select) e dataInicio (date).
   */
  formCargo: FormGroup = this.criarFormCargo();

  /**
   * cargosDisponiveis
   * Computed: catálogo de cargos ativos filtrado para remover os que o
   * associado já exerce ativamente. Comparação por nomeCargo normalizado
   * (trim + lowercase) — o ResponseDto de cargo do associado não expõe
   * idCargoLideranca, então nome é a única chave comparável.
   *
   * Recalcula automaticamente sempre que cargos() ou cargosDoAssociado()
   * mudam (ex: após um POST bem-sucedido que adiciona à lista).
   */
  cargosDisponiveis = computed(() => {
    const nomesAtivos = new Set(
      this.cargosDoAssociado()
        .filter(c => c.ativo)
        .map(c => c.nomeCargo.trim().toLowerCase())
    );
    return this.cargos().filter(
      c => !nomesAtivos.has(c.nomeCargo.trim().toLowerCase())
    );
  });

  // =========================================================================
  // SIGNALS — MODAL DE EDIÇÃO (Bloco 4)
  //
  // Separados dos signals de cadastro para que os dois fluxos não interfiram.
  // associadoParaEditar guarda o objeto completo carregado via GET — é a fonte
  // de verdade para os campos silenciosos enviados no PUT.
  // =========================================================================

  /**
   * associadoParaEditar
   * Dados frescos do associado. Preenchido no forkJoin de abrirModalEdicao().
   * Campos que o formulário não expõe (dataIngresso, statusAssociado, etc.)
   * são lidos diretamente daqui na hora do submit.
   */
  associadoParaEditar = signal<AssociadoResponseDto | null>(null);

  /** Spinner que substitui o corpo do modal enquanto os GETs do forkJoin carregam. */
  carregandoEdicao      = signal(false);

  /** Spinner do botão "Salvar Alterações" durante o PUT. */
  carregandoSalvarEdicao = signal(false);

  /** Mensagem de erro exibida no rodapé do modal de edição. */
  erroModalEdicao       = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400). */
  errosValidacaoEdicao  = signal<Record<string, string>>({});


  /**
   * idCargoSilencioso / dataInicioCargoSilencioso
   * Cargo ativo do associado, necessário para preencher idCargoLideranca e
   * dataInicioCargo no PUT (o backend valida @NotNull — não pode omitir).
   * O cargo NÃO aparece no formulário de edição; é carregado silenciosamente
   * via GET /associados-cargos/associado/{id} e enviado como dado invisível.
   *
   * Como AssociadoCargoLiderancaResponseDto não expõe idCargoLideranca,
   * o ID é encontrado por match de nomeCargo no catálogo de cargos.
   */
  idCargoSilencioso           = signal<number | null>(null);
  dataInicioCargoSilencioso   = signal<string | null>(null);

  // =========================================================================
  // SIGNALS — MODAL DE EQUIPE
  //
  // Fluxo simples (sem forkJoin): a lista de equipes já está carregada em
  // this.equipes() desde o ngOnInit. O modal apenas exibe os dados do
  // associado clicado e um select com todas as equipes ativas.
  // =========================================================================

  /**
   * associadoParaEquipe
   * Associado da linha clicada. Fonte de verdade do idAssociado no PUT.
   * Também fornece nomeEquipeOrigem e nomeEquipe para exibição readonly.
   */
  associadoParaEquipe = signal<AssociadoResponseDto | null>(null);

  /** Spinner do botão "Salvar Transferência" durante o PUT. */
  carregandoModalEquipe = signal(false);

  /** Mensagem de erro exibida no rodapé do modal. */
  erroModalEquipe = signal<string | null>(null);

  /**
   * formEquipe
   * Formulário com um único campo: idEquipe.
   * patchValue() ao abrir o modal pré-seleciona a equipe atual;
   * o botão salvar só habilita quando o usuário altera (form.dirty).
   */
  formEquipe: FormGroup = this.criarFormEquipe();

  // =========================================================================
  // SIGNALS — MODAL DE ENDEREÇO RESIDENCIAL
  //
  // Fluxo em duas fases:
  //   Fase 1 (Lista): exibe os endereços cadastrados do associado com
  //     botão "Editar" por linha e botão "Adicionar Novo Endereço".
  //   Fase 2 (Form): exibe o formulário de criação ou edição.
  //     modoFormEndereco controla qual fase está ativa:
  //       null    → apenas a lista
  //       'novo'  → formulário em branco (POST)
  //       'editar'→ formulário pré-preenchido (PUT)
  // =========================================================================

  /**
   * associadoParaEndereco
   * Associado da linha clicada. Fonte de verdade do idAssociado nas chamadas HTTP.
   */
  associadoParaEndereco = signal<AssociadoResponseDto | null>(null);

  /**
   * enderecosDoAssociado
   * Lista carregada via GET ao abrir o modal.
   * Recarregada após cada POST/PUT bem-sucedido.
   */
  enderecosDoAssociado = signal<EnderecoResidencialResponseDto[]>([]);

  /** Spinner que substitui o corpo do modal durante o GET inicial. */
  /**
   * Controla o spinner do botão de endereço na tabela enquanto o GET inicial
   * roda — antes do modal ser aberto. Mesmo padrão de carregandoVerificarCargos
   * e carregandoVerificarEmpresa.
   */
  carregandoVerificarEndereco = signal(false);

  /** Spinner do botão "Salvar Endereço" durante POST/PUT. */
  carregandoModalEndereco = signal(false);

  /** Mensagem de erro exibida no rodapé do modal. */
  erroModalEndereco = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400). */
  errosValidacaoEndereco = signal<Record<string, string>>({});

  /**
   * modoFormEndereco
   * Controla se o formulário está visível e em qual modo.
   *   null     → só a lista de endereços
   *   'novo'   → formulário vazio (POST)
   *   'editar' → formulário pré-preenchido (PUT)
   */
  modoFormEndereco = signal<'novo' | 'editar' | null>(null);

  /**
   * enderecoParaEditar
   * Endereço clicado para edição. Fornece o idEndereco para o PUT
   * e os valores iniciais para o patchValue().
   */
  enderecoParaEditar = signal<EnderecoResidencialResponseDto | null>(null);

  /**
   * formEndereco
   * Formulário do modal de endereço.
   * Compartilhado entre criação e edição — resetado ou preenchido
   * antes de exibir o formulário.
   */
  formEndereco: FormGroup = this.criarFormEndereco();

  /**
   * idEnderecoCopiado
   * ID do endereço cujo botão "Copiar" foi clicado recentemente.
   * Fica populado por 2 segundos para exibir o feedback visual ("Copiado!").
   * null quando nenhum endereço foi copiado ou após o timeout.
   */
  idEnderecoCopiado = signal<number | null>(null);

  // =========================================================================
  // SIGNALS — CONFIRMAÇÃO DE CADASTRO (Bloco 5)
  //
  // Fluxo simples: sem formulário, sem forkJoin.
  // O associado clicado é guardado em associadoParaConfirmar; o modal exibe
  // o nome e um aviso; ao confirmar, o PATCH é disparado e o alerta verde
  // aparece na tela por 3 segundos.
  // =========================================================================

  /** Associado da linha clicada. Fonte de verdade do id no PATCH. */
  associadoParaConfirmar = signal<AssociadoResponseDto | null>(null);

  /** Controla o spinner do botão "Sim, ativar" durante o PATCH. */
  carregandoConfirmacao  = signal(false);

  /** Mensagem de erro exibida dentro do modal de confirmação. */
  erroConfirmacao        = signal<string | null>(null);

  // =========================================================================
  // SIGNALS — MODAL ALTERAR STATUS (Bloco 5.2)
  //
  // statusNovoSelecionado espelha o valor do select em um signal, permitindo
  // que o template use @if reativamente para exibir os campos condicionais
  // sem precisar ler form.get('statusNovo')?.value diretamente no template.
  // =========================================================================

  /** Associado da linha clicada. Fonte de verdade do id no PATCH. */
  associadoParaAlterarStatus = signal<AssociadoResponseDto | null>(null);

  /** Controla o spinner do botão "Salvar" durante o PATCH. */
  carregandoAlterarStatus    = signal(false);

  /** Mensagem de erro exibida dentro do modal de alteração de status. */
  erroModalAlterarStatus     = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400) no modal de alterar status. */
  errosValidacaoAlterarStatus = signal<Record<string, string>>({});

  /**
   * statusNovoSelecionado
   * Espelha o valor do select de status. Atualizado pelo observarStatusAlteracao()
   * via valueChanges. Usado no template para @if dos campos condicionais.
   */
  statusNovoSelecionado = signal<StatusAssociado | null>(null);

  /**
   * statusOpcoesParaAlteracao
   * Computed: filtra o STATUS_OPCOES removendo o status atual do associado.
   * Evita que o ADM "altere" para o mesmo status que já está ativo.
   *
   * Regra adicional: PREATIVO é um status de entrada — uma vez que o associado
   * está ATIVO, não faz sentido retroceder para pré-ativo. A opção é ocultada.
   */
  statusOpcoesParaAlteracao = computed(() => {
    const associado = this.associadoParaAlterarStatus();
    if (!associado) return this.STATUS_OPCOES;
    return this.STATUS_OPCOES.filter(op => {
      if (op.valor === associado.statusAssociado) return false;
      if (associado.statusAssociado === 'ATIVO' && op.valor === 'PREATIVO') return false;
      return true;
    });
  });

  formAlterarStatus: FormGroup = this.criarFormAlterarStatus();

  // =========================================================================
  // SIGNALS — MODAL RENOVAR ANUIDADE (Bloco 5.3)
  // =========================================================================

  /** Associado da linha clicada. Fonte de verdade do id no PATCH. */
  associadoParaRenovar = signal<AssociadoResponseDto | null>(null);

  /** Controla o spinner do botão "Confirmar Renovação" durante o PATCH. */
  carregandoRenovar    = signal(false);

  /** Mensagem de erro exibida dentro do modal de renovação. */
  erroModalRenovar     = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400) no modal de renovação. */
  errosValidacaoRenovar = signal<Record<string, string>>({});

  formRenovar: FormGroup = this.criarFormRenovar();

  // =========================================================================
  // SIGNALS — MODAL DE EMPRESA (Bloco 6)
  //
  // Fluxo em duas fases, espelhando o modal de endereços residenciais:
  //   Fase 1 (modoFormEmpresa === null)     → lista de empresas do associado
  //   Fase 2 (modoFormEmpresa === 'novo')   → formulário vazio (POST atômico)
  //   Fase 2 (modoFormEmpresa === 'editar') → formulário pré-preenchido (dois PUTs)
  //
  // Abertura: GET /api/v1/empresas/associado/{id} → carrega lista → abre modal.
  // O modal NÃO fecha ao salvar — volta para a Fase 1 com a lista atualizada.
  // =========================================================================

  /**
   * associadoParaEmpresa
   * Associado da linha clicada. Fonte de verdade do idAssociado nos requests HTTP.
   * Null enquanto o modal está fechado.
   */
  associadoParaEmpresa = signal<AssociadoResponseDto | null>(null);

  /**
   * empresasDoAssociado
   * Lista de empresas carregadas na Fase 1. Atualizada sem reload de página
   * após cada cadastro ou edição bem-sucedidos.
   */
  empresasDoAssociado = signal<EmpresaResponseDto[]>([]);

  /**
   * modoFormEmpresa
   * Controla qual fase o modal exibe:
   *   null     → Fase 1: lista de empresas
   *   'novo'   → Fase 2: formulário vazio (POST)
   *   'editar' → Fase 2: formulário pré-preenchido (PUT)
   */
  modoFormEmpresa = signal<null | 'novo' | 'editar'>(null);

  /**
   * idEmpresaAtual
   * Preenchido ao ativar o modo edição. Usado na URL do PUT /api/v1/empresas/{id}.
   */
  idEmpresaAtual = signal<number | null>(null);

  /**
   * idEnderecoComercialAtual
   * Preenchido ao ativar o modo edição com o idEnderecoComercial retornado pelo
   * GET /api/v1/enderecos-comerciais/empresa/{idEmpresa}.
   * CRÍTICO: sem este ID não é possível editar o endereço.
   */
  idEnderecoComercialAtual = signal<number | null>(null);

  /**
   * carregandoVerificarEmpresa
   * Spinner no botão "Empresa" da tabela enquanto o GET inicial
   * (buscarEmpresaPorAssociado) está em andamento. Evita duplo clique.
   */
  carregandoVerificarEmpresa = signal(false);

  /**
   * carregandoEdicaoEmpresa
   * Spinner que substitui o formulário enquanto o GET de endereço
   * (buscarEnderecoPorEmpresa) está em andamento ao abrir a edição.
   */
  carregandoEdicaoEmpresa = signal(false);

  /**
   * carregandoModalEmpresa
   * Spinner do botão "Salvar" durante o POST (novo) ou o forkJoin de PUTs (editar).
   */
  carregandoModalEmpresa = signal(false);

  /** Mensagem de erro exibida no rodapé do modal de empresa. */
  erroModalEmpresa = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400). Exibidos inline no template. */
  errosValidacaoEmpresa = signal<Record<string, string>>({});

  /**
   * formEmpresa
   * Painel A (empresa): razaoSocial, cnpj, nomeFantasia.
   * Painel B (endereço comercial): rua, numero, complemento, bairro, cidade, estado, cep.
   * Compartilhado entre cadastro e edição — resetado ou pré-preenchido via patchValue().
   */
  formEmpresa: FormGroup = this.criarFormEmpresa();

  /**
   * formatarEndereco
   * Exposição da função pura do helper para o template.
   * Angular templates não acessam imports diretamente — a função precisa
   * ser acessível via propriedade ou método do componente.
   */
  readonly formatarEndereco = formatarEnderecoResidencial;

  // =========================================================================
  // SIGNALS — MODAL DE INFORMAÇÕES (Bloco 7)
  //
  // Dados carregados via forkJoin ao abrir o modal (Tarefa 7.2).
  // Um spinner no botão da tabela cobre o período de carregamento.
  // O modal só abre após o forkJoin completar com sucesso.
  // =========================================================================

  /** Spinner no botão da tabela enquanto o forkJoin carrega. */
  carregandoVerificarInfo = signal(false);

  /** Dados das 9 seções da modal de informações */
  enderecosInfoAssociado   = signal<EnderecoResidencialResponseDto[]>([]);
  cargosInfoAssociado      = signal<AssociadoCargoLiderancaResponseDto[]>([]);
  empresasInfoAssociado    = signal<EmpresaResponseDto[]>([]);
  grupamentosInfoAssociado = signal<AssociadoGrupamentoResponseDto[]>([]);
  anuidadesInfoAssociado   = signal<AssociadoAnuidadeResponseDto[]>([]);
  renovacoesInfoAssociado  = signal<AssociadoRenovacaoResponseDto[]>([]);
  perfilInfoAssociado      = signal<PerfilAssociadoResponseDto | null>(null);

  /** Visibilidade do associado — necessária para montar o PUT de dados pessoais. */
  visibilidadeInfoAssociado = signal<AssociadoVisibilidadeResponseDto | null>(null);

  // =========================================================================
  // SIGNALS — SUBMODAL EDITAR DADOS PESSOAIS (Tarefa 7.3)
  // =========================================================================

  /** Spinner do botão "Salvar Alterações" no submodal de dados pessoais. */
  carregandoEditarDados     = signal(false);

  /** Mensagem de erro exibida no rodapé do submodal. */
  erroModalEditarDados      = signal<string | null>(null);

  /** Erros por campo retornados pelo backend (400). */
  errosValidacaoEditarDados = signal<Record<string, string>>({});

  /** Formulário reativo do submodal (4 campos editáveis). */
  formEditarDados: FormGroup = this.criarFormEditarDados();

  // =========================================================================
  // SIGNALS — DADOS DE SUPORTE (dropdowns do modal)
  //
  // Carregados via forkJoin ao abrir o modal (Tarefa 3.1).
  // Reutilizados entre aberturas — só recarregam se a lista estiver vazia.
  // =========================================================================

  clusters = signal<ClusterResponseDto[]>([]);
  cargos   = signal<CargoLiderancaResponseDto[]>([]);

  /**
   * atuacoes
   * Populado dinamicamente quando o usuário seleciona um cluster.
   * Resetado ao trocar de cluster ou ao fechar o modal.
   */
  atuacoes = signal<AtuacaoEspecificaResponseDto[]>([]);

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE DE PADRINHO (Tarefa 3.3)
  //
  // O padrinho é um campo de busca livre (não um select) porque a lista de
  // associados é grande. O texto digitado é um intermediário de UI — o dado
  // real que vai para o DTO é o idPadrinhoSelecionado.
  // =========================================================================

  nomePadrinhoInput        = signal('');
  sugestoesPadrinho        = signal<AssociadoResponseDto[]>([]);
  idPadrinhoSelecionado    = signal<number | null>(null);
  mostrarSugestoesPadrinho = signal(false);
  buscandoPadrinho         = signal(false);

  /**
   * erroPadrinho
   * Mensagem de erro exibida inline abaixo do campo de padrinho quando o
   * usuário tenta submeter sem selecionar um padrinho.
   * Limpo no resetarFormularioCadastro() e ao selecionar um padrinho.
   */
  erroPadrinho = signal<string | null>(null);

  /**
   * padrinhoSubject
   *
   * Canal de debounce para a busca de padrinho. Cada keystroke emite aqui;
   * o pipe switchMap cancela a requisição anterior e dispara uma nova após
   * 300ms de silêncio. Evita requisições desnecessárias e race conditions.
   */
  private readonly padrinhoSubject = new Subject<string>();

  // =========================================================================
  // FORMULÁRIO REATIVO — CADASTRO (Tarefa 3.2 / 3.3 / 3.4)
  //
  // Por que ReactiveFormsModule?
  // CLAUDE.md §8.1: formulários com 6+ campos devem usar ReactiveFormsModule
  // + FormBuilder. O modal de cadastro tem 17 campos.
  // =========================================================================

  formCadastro: FormGroup = this.criarFormCadastro();

  /**
   * formEdicao
   * Formulário reativo do modal de edição. Campos que não aparecem na UI
   * (dataIngresso, cargo, etc.) não estão aqui — são lidos de associadoParaEditar()
   * e injetados no DTO silenciosamente no salvarEdicao().
   *
   * CPF é disabled: visível como identificação mas não editável.
   * getRawValue() o inclui no valor lido para o PUT.
   */
  formEdicao: FormGroup = this.criarFormEdicao();

  // =========================================================================
  // CONSTANTES
  //
  // Expostas como propriedades readonly para o template acessar
  // sem depender de imports no HTML (Angular encapsula o escopo do template).
  // =========================================================================

  readonly LABELS_STATUS = LABELS_STATUS_ASSOCIADO;
  readonly STATUS_OPCOES = STATUS_ASSOCIADO_OPCOES;

  // =========================================================================
  // COMPUTED — CONTADORES (KPI cards)
  //
  // computed(): os valores derivam diretamente
  // do signal associados(), sem efeitos colaterais. Recalculam automaticamente
  // quando a lista muda (nova página carregada ou filtro aplicado).
  // =========================================================================

  totalAtivos    = computed(() => this.associados().filter(a => a.statusAssociado === 'ATIVO').length);
  totalPreAtivos = computed(() => this.associados().filter(a => a.statusAssociado === 'PREATIVO').length);
  totalInativos  = computed(() =>
    this.associados().filter(a => (a.statusAssociado as string).startsWith('INATIVO')).length
  );

  /** Verificação de perfil ADM — usada no template para controle de visibilidade. */
  readonly isAdm = computed(() => this.authService.temPermissao('ADM_CC'));

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    // Debounce da busca por texto (listagem)
    this.buscaSubject.pipe(
      debounceTime(1000),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.carregarAssociados(0));

    // Inicia os observadores dos modais
    this.observarCluster();         // cadastro: cascata cluster → atuação específica
    this.observarPadrinho();        // cadastro: debounce autocomplete padrinho
    this.observarStatusAlteracao(); // 5.2: campos condicionais do modal de status

    // Carga inicial da listagem
    this.carregarAssociados();
    this.carregarEquipes();
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — FILTROS DA LISTAGEM
  // =========================================================================

  /**
   * atualizarBusca(valor)
   *
   * Atualiza o signal para reflexo imediato no input (UX),
   * mas delega a chamada ao backend para o buscaSubject com debounce.
   */
  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
    this.buscaSubject.next(valor);
  }

  /** Selects disparam imediatamente — sem debounce (ação discreta, não contínua). */
  atualizarFiltroStatus(valor: StatusAssociado | 'Todos'): void {
    this.filtroStatus.set(valor);
    this.carregarAssociados(0);
  }

  atualizarFiltroEquipe(idEquipe: string): void {
    this.filtroEquipeId.set(idEquipe === 'Todos' ? null : Number(idEquipe));
    this.carregarAssociados(0);
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — PAGINAÇÃO
  // =========================================================================

  /**
   * totalPaginasArray()
   *
   * Gera array de índices [0, 1, ..., totalPaginas-1].
   * Usado pelo @for do template para renderizar os botões numéricos de página.
   */
  totalPaginasArray(): number[] {
    return Array.from({ length: this.totalPaginas() }, (_, i) => i);
  }

  /**
   * irParaPagina(pagina)
   *
   * Único ponto de entrada de navegação — valida os limites antes de agir.
   * proximaPagina e paginaAnterior delegam para cá.
   */
  irParaPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.carregarAssociados(pagina);
  }

  proximaPagina(): void  { this.irParaPagina(this.paginaAtual() + 1); }
  paginaAnterior(): void { this.irParaPagina(this.paginaAtual() - 1); }

  // =========================================================================
  // MÉTODOS PÚBLICOS — HELPERS DE TEMPLATE
  // =========================================================================

  /**
   * formatarData(data)
   *
   * Converte yyyy-MM-dd (ISO 8601 do backend) em dd/MM/yyyy (legível pelo usuário).
   * Retorna '—' para datas nulas (campos opcionais como dataVencimento de isentos).
   */
  formatarData(data: string | null): string {
    if (!data) return '—';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * mascararCpf(cpf)
   *
   * Exibe CPF parcialmente mascarado: primeiros 3 dígitos + *** + último trecho.
   * Ex: "12345678901" → "123.***.***-01"
   * Preserva legibilidade suficiente para identificação sem expor o dado completo.
   */
  mascararCpf(cpf: string): string {
    if (!cpf || cpf.length !== 11) return cpf ?? '—';
    return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
  }

  /**
   * iniciais(nome)
   *
   * Extrai as iniciais do primeiro e último nome para o avatar.
   * Ex: "João Carlos Silva" → "JS"
   * Reutilizado no autocomplete de padrinho.
   */
  iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * classeStatus(status)
   *
   * Mapeia o enum de status para as classes CSS correspondentes do styles.css global.
   * Todos os status INATIVO_* recebem a classe status-inativa — variações de
   * subtipo são expressas apenas no label (LABELS_STATUS), não na cor.
   */
  classeStatus(status: StatusAssociado): string {
    switch (status) {
      case 'ATIVO':    return 'status-chip status-ativa';
      case 'PREATIVO': return 'status-chip status-pre-ativo';
      default:         return 'status-chip status-inativa';   // todos os INATIVO_*
    }
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE CADASTRO — Bloco 3
  // =========================================================================

  /**
   * abrirModalCadastro()
   *
   * Chamado pelo (click) do botão "Novo Associado" — antes do Bootstrap
   * abrir o modal visualmente. Reseta o estado do formulário e dispara
   * o carregamento dos dados de suporte.
   *
   * O Bootstrap abre o modal pelo data-bs-toggle no botão da listagem.
   */
  abrirModalCadastro(): void {
    this.resetarFormularioCadastro();
    this.carregarDadosModal();
  }

  /**
   * resetarFormularioCadastro()
   *
   * Reseta o formulário e todos os signals do modal ao estado inicial.
   * Chamado ao abrir o modal, pelo botão Cancelar e pelo ícone X.
   *
   * Nota: formCadastro.reset() dispara valueChanges do idCluster,
   * que automaticamente desabilita idAtuacaoEspecifica via observarCluster().
   */
  resetarFormularioCadastro(): void {
    this.formCadastro.reset({
      exibirAniversario: true,
      dataInicioCargo:   this.obterDataHoje(),
    });
    this.erroModal.set(null);
    this.errosValidacao.set({});
    this.erroPadrinho.set(null);
    this.idPadrinhoSelecionado.set(null);
    this.nomePadrinhoInput.set('');
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
    this.atuacoes.set([]);

    // Reaplica o cargo Associado após o reset — o reset() zera todos os
    // controles, incluindo os disabled. Se os cargos já estão em memória
    // (reabertura do modal), restaura imediatamente sem nova requisição.
    this.aplicarCargoAssociado();
  }

  /**
   * salvarNovoAssociado() — Tarefa 3.5
   *
   * Monta o AssociadoRequestDto a partir do formulário e do signal de padrinho,
   * remove máscaras dos campos numéricos e delega ao service.
   *
   * O status é sempre 'PREATIVO' — nunca exibido ao usuário.
   * idEquipe e idEquipeOrigem recebem o MESMO valor no cadastro (conforme PRD).
   */
  salvarNovoAssociado(): void {
    // Marca todos os campos como tocados — exibe erros inline mesmo nos campos
    // que o usuário não interagiu, dando feedback visual completo no submit.
    this.formCadastro.markAllAsTouched();

    // Padrinho é obrigatório — campo fora do FormGroup, validação manual
    if (!this.idPadrinhoSelecionado()) {
      this.erroPadrinho.set('Selecione um padrinho para continuar.');
      return;
    }
    this.erroPadrinho.set(null);

    this.carregandoModal.set(true);
    this.erroModal.set(null);
    this.errosValidacao.set({});

    const val = this.formCadastro.getRawValue();

    const dto: AssociadoRequestDto = {
      // ── Dados pessoais ──────────────────────────────────────
      nomeCompleto:      val.nomeCompleto?.trim(),
      cpf:               (val.cpf as string).replace(/\D/g, ''),
      emailPrincipal:    val.emailPrincipal?.trim(),
      telefonePrincipal: (val.telefonePrincipal as string).replace(/\D/g, ''),
      dataNascimento:    val.dataNascimento,

      // ── Dados administrativos ───────────────────────────────
      dataIngresso:                  val.dataIngresso,
      dataPagamentoPrimeiraAnuidade: val.dataPagamentoPrimeiraAnuidade || null,

      // ── Status e origem — fixos no cadastro ─────────────────
      statusAssociado:  'PREATIVO',
      tipoOrigemEquipe: 'ORIGINAL',

      // ── Vínculos ────────────────────────────────────────────
      idEquipeAtual:            Number(val.idEquipe),
      idEquipeOrigem:      Number(val.idEquipe), // mesmo valor no cadastro (PRD)
      idCluster:           Number(val.idCluster),
      idAtuacaoEspecifica: Number(val.idAtuacaoEspecifica),
      idPadrinho:          this.idPadrinhoSelecionado(),
      idCargoLideranca:    Number(val.idCargoLideranca),
      dataInicioCargo:     val.dataInicioCargo,

      // ── Visibilidade ────────────────────────────────────────
      exibirAniversario: val.exibirAniversario ?? false,

      // ── Endereço residencial ─────────────────────────────────
      rua:         val.rua?.trim(),
      numero:      val.numero?.trim(),
      complemento: val.complemento?.trim() || null,
      bairro:      val.bairro?.trim(),
      cidade:      val.cidade?.trim(),
      estado:      (val.estado as string).toUpperCase().trim(),
      cep:         (val.cep as string).replace(/\D/g, ''),
    };

    this.associadoService.cadastrarAssociado(dto).subscribe({
      next: () => {
        this.btnFecharCadastro.nativeElement.click();
        this.carregarAssociados(0); // novo item: volta à primeira página
        this.toastService.sucesso('Associado cadastrado com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao cadastrar associado:', err);
        if (err.error?.errors) {
          // Backend retornou erros por campo (normalmente 400) — exibe inline
          const errosNormalizados = this.normalizarErros(err.error.errors);

          // idPadrinho não é FormControl — redireciona para o signal erroPadrinho
          if (errosNormalizados['idPadrinho']) {
            this.erroPadrinho.set(errosNormalizados['idPadrinho']);
            delete errosNormalizados['idPadrinho'];
          }

          this.errosValidacao.set(errosNormalizados);
          this.mostrarErroModal('Corrija os campos destacados.');
        } else if (err.status === 409) {
          // Conflito de unicidade — mapeia a mensagem ao campo pela palavra-chave
          const msg = err.error?.message ?? 'Dado duplicado. Verifique os campos.';
          const errosMapeados: Record<string, string> = {};
          if (/cpf/i.test(msg))          errosMapeados['cpf'] = msg;
          else if (/e-?mail/i.test(msg)) errosMapeados['emailPrincipal'] = msg;
          else if (/cnpj/i.test(msg))    errosMapeados['cnpj'] = msg;

          if (Object.keys(errosMapeados).length > 0) {
            this.errosValidacao.set(errosMapeados);
            this.mostrarErroModal('Corrija os campos destacados.');
          } else {
            this.mostrarErroModal(msg);
          }
        } else {
          this.mostrarErroModal(this.extrairMensagemErro(err));
        }
        this.carregandoModal.set(false);
      },
      complete: () => {
        this.carregandoModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE CARGO (Bloco 4)
  // =========================================================================

  /**
   * abrirModalCargo(associado)
   *
   * Chamado pelo (click) do botão de cargo na tabela. Carrega em paralelo:
   *   - Cargos do associado (sempre frescos — GET por associado)
   *   - Catálogo de cargos (só se ainda não estiver em memória)
   *
   * Por que não usa data-bs-toggle?
   * Mesmo padrão de abrirModalEmpresa: o modal só é exibido após o forkJoin
   * concluir, evitando que o usuário veja um modal "fantasma" com header
   * preenchido e body em spinner caso a rede esteja lenta ou o GET falhe.
   * O spinner fica no botão da tabela (carregandoVerificarCargos) durante a espera.
   *
   * Por que forkJoin com of(null)?
   * Se o catálogo já foi carregado (ex: modal de cadastro aberto antes),
   * of(null) completa imediatamente — o forkJoin não bloqueia para um GET
   * desnecessário. O bloco next verifica catalogo !== null antes de setar.
   */
  abrirModalCargo(associado: AssociadoResponseDto): void {
    // Limpa estado antes do GET para que o modal abra zerado
    this.associadoParaCargo.set(associado);
    this.cargosDoAssociado.set([]);
    this.erroModalCargo.set(null);
    this.errosValidacaoCargo.set({});
    this.formCargo.reset({ dataInicio: this.obterDataHoje() });
    this.carregandoVerificarCargos.set(true);

    forkJoin({
      cargosAssociado: this.associadoCargoService.listarPorAssociado(associado.idAssociado),
      catalogo: this.cargos().length > 0
        ? of(null)
        : this.cargoService.listar(0, 100),
    }).subscribe({
      next: ({ cargosAssociado, catalogo }) => {
        this.cargosDoAssociado.set(cargosAssociado);
        if (catalogo) {
          // Filtra apenas ativos para os selects (mesmo critério do modal de cadastro)
          this.cargos.set(catalogo.items.filter((c: CargoLiderancaResponseDto) => c.ativo));
        }
        this.carregandoVerificarCargos.set(false);
        bootstrap.Modal.getOrCreateInstance(this.modalCargosRef.nativeElement).show();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados do modal de cargo:', err);
        this.carregandoVerificarCargos.set(false);
        this.toastService.erro('Erro ao carregar cargos. Tente novamente.');
        // Modal não é aberto — usuário recebe feedback via toast
      },
    });
  }

  /**
   * salvarCargo()
   *
   * Monta o AssociadoCargoLiderancaRequestDto e faz POST.
   * Após sucesso: atualiza cargosDoAssociado() com o novo cargo retornado
   * e reseta o formulário — o modal permanece aberto para atribuições adicionais.
   * O computed cargosDisponiveis() se atualiza automaticamente, removendo
   * o cargo recém-atribuído do select.
   */
  salvarCargo(): void {
    const associado = this.associadoParaCargo();
    if (!associado) return;

    this.carregandoModalCargo.set(true);
    this.erroModalCargo.set(null);
    this.errosValidacaoCargo.set({});

    const val = this.formCargo.getRawValue();

    const dto: AssociadoCargoLiderancaRequestDto = {
      idAssociado:      associado.idAssociado,
      idCargoLideranca: Number(val.idCargoLideranca),
      dataInicio:       val.dataInicio,
      dataFim:          null,  // indeterminado — encerramento é operação separada
      ativo:            true,
    };

    this.associadoCargoService.designarCargo(dto).subscribe({
      next: (novoCargo) => {
        // Adiciona ao final da lista sem recarregar — o computed recalcula em seguida
        this.cargosDoAssociado.update(lista => [...lista, novoCargo]);
        this.formCargo.reset({ dataInicio: this.obterDataHoje() });
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao atribuir cargo:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoCargo.set(this.normalizarErros(err.error.errors));
          this.mostrarErroNaModal(this.erroModalCargo, 'Corrija os campos destacados.');
        } else if (err.status === 409) {
          this.mostrarErroNaModal(
            this.erroModalCargo,
            err.error?.message ?? 'Este associado já possui este cargo ativo.'
          );
        } else {
          this.mostrarErroNaModal(this.erroModalCargo, this.extrairMensagemErro(err));
        }
        this.carregandoModalCargo.set(false);
      },
      complete: () => this.carregandoModalCargo.set(false),
    });
  }

  /**
   * prepararEncerramentoCargo(cargo)
   *
   * Chamado pelo (click) do botão encerrar na tabela de cargos.
   * Registra o cargo selecionado e abre o modal de confirmação via API
   * do Bootstrap (getOrCreateInstance + show) — evita race condition de
   * backdrop duplo ao empilhar sobre o modal de cargos já aberto.
   */
  prepararEncerramentoCargo(cargo: AssociadoCargoLiderancaResponseDto): void {
    this.cargoParaEncerrar.set(cargo);
    this.encerrandoCargoId.set(null);
    bootstrap.Modal.getOrCreateInstance(
      this.modalConfirmarEncerramentoCargo.nativeElement
    ).show();
  }

  /**
   * encerrarCargo()
   *
   * Chamado pelo botão "Confirmar" no modal de confirmação de encerramento.
   * Lê o cargo de cargoParaEncerrar() e envia PUT com ativo: false e dataFim = hoje.
   *
   * O ResponseDto não expõe idCargoLideranca — resolvido via match de nomeCargo
   * no catálogo já carregado em cargos() (mesmo mecanismo de idCargoSilencioso).
   *
   * Após sucesso: fecha o modal de confirmação via botão oculto (ViewChild) e
   * atualiza o registro no signal localmente — o modal de cargos permanece aberto
   * e o computed cargosDisponiveis() libera o cargo para nova atribuição.
   */
  encerrarCargo(): void {
    const cargo    = this.cargoParaEncerrar();
    const associado = this.associadoParaCargo();
    if (!cargo || !associado) return;

    // Localiza o idCargoLideranca no catálogo por nomeCargo (ResponseDto não expõe FK)
    const cargoNoCatalogo = this.cargos().find(
      c => c.nomeCargo.trim().toLowerCase() === cargo.nomeCargo.trim().toLowerCase()
    );
    if (!cargoNoCatalogo) {
      this.mostrarErroNaModal(this.erroModalCargo, 'Cargo não encontrado no catálogo. Feche e reabra o modal.');
      return;
    }

    this.encerrandoCargoId.set(cargo.idAssociadoCargo);

    const dto: AssociadoCargoLiderancaRequestDto = {
      idAssociado:      associado.idAssociado,
      idCargoLideranca: cargoNoCatalogo.idCargoLideranca,
      dataInicio:       cargo.dataInicio,
      dataFim:          this.obterDataHoje(),
      ativo:            false,
    };

    this.associadoCargoService.editarCargo(cargo.idAssociadoCargo, dto).subscribe({
      next: (atualizado) => {
        // Fecha o modal de confirmação — o modal de cargos permanece aberto
        this.btnFecharConfirmacaoCargo.nativeElement.click();
        this.cargosDoAssociado.update(lista =>
          lista.map(c => c.idAssociadoCargo === atualizado.idAssociadoCargo ? atualizado : c)
        );
        this.cargoParaEncerrar.set(null);
      },
      error: (err: HttpErrorResponse) => {
        // Fecha o modal de confirmação — o modal de cargos permanece aberto
        this.btnFecharConfirmacaoCargo.nativeElement.click();
        console.error('Erro ao encerrar cargo:', err);
        this.mostrarErroNaModal(this.erroModalCargo, this.extrairMensagemErro(err));
        this.encerrandoCargoId.set(null);
      },
      complete: () => this.encerrandoCargoId.set(null),
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE INFORMAÇÕES (Bloco 7)
  // =========================================================================

  /**
   * abrirModalInformacoes(associado)
   *
   * Dispara um forkJoin com 8 GETs em paralelo (Tarefa 7.2).
   * O modal só abre após todos os GETs completarem. Se o GET principal
   * (associado) falhar, exibe toast e não abre o modal.
   * GETs secundários usam catchError(() => of([])) para que uma falha
   * isolada não bloqueie as demais seções.
   */
  abrirModalInformacoes(associado: AssociadoResponseDto): void {
    this.carregandoVerificarInfo.set(true);
    // Set imediato para o @if do spinner no template funcionar por comparação de ID.
    this.associadoParaEditar.set(associado);

    forkJoin({
      dados:        this.associadoService.buscarAssociadoPorId(associado.idAssociado),
      enderecos:    this.associadoService.listarEnderecosResidenciais(associado.idAssociado)
                      .pipe(catchError(() => of([]))),
      cargos:       this.associadoCargoService.listarPorAssociado(associado.idAssociado)
                      .pipe(catchError(() => of([]))),
      empresas:     this.empresaService.buscarEmpresaPorAssociado(associado.idAssociado)
                      .pipe(catchError(() => of({ items: [] as EmpresaResponseDto[] }))),
      grupamentos:  this.associadoGrupamentoService.listarPorAssociado(associado.idAssociado)
                      .pipe(catchError(() => of([]))),
      anuidades:    this.associadoAnuidadeService.listarAnuidades(associado.idAssociado)
                      .pipe(catchError(() => of([]))),
      renovacoes:   this.associadoAnuidadeService.listarRenovacoes(associado.idAssociado)
                      .pipe(catchError(() => of([]))),
      perfil:       this.perfilAssociadoService.buscarPorAssociado(associado.idAssociado)
                      .pipe(catchError(() => of(null))),
      visibilidade: this.associadoService.buscarVisibilidade(associado.idAssociado)
                      .pipe(catchError(() => of(null))),
    }).subscribe({
      next: (r) => {
        this.associadoParaEditar.set(r.dados);
        this.enderecosInfoAssociado.set(r.enderecos as EnderecoResidencialResponseDto[]);
        this.cargosInfoAssociado.set(r.cargos as AssociadoCargoLiderancaResponseDto[]);
        this.empresasInfoAssociado.set((r.empresas as { items: EmpresaResponseDto[] }).items);
        this.grupamentosInfoAssociado.set(r.grupamentos as AssociadoGrupamentoResponseDto[]);
        this.anuidadesInfoAssociado.set(r.anuidades as AssociadoAnuidadeResponseDto[]);
        this.renovacoesInfoAssociado.set(r.renovacoes as AssociadoRenovacaoResponseDto[]);
        this.perfilInfoAssociado.set(r.perfil as PerfilAssociadoResponseDto | null);
        this.visibilidadeInfoAssociado.set(r.visibilidade as AssociadoVisibilidadeResponseDto | null);
        bootstrap.Modal.getOrCreateInstance(this.modalInfoRef.nativeElement).show();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar dados do associado:', err);
        this.associadoParaEditar.set(null);
        this.toastService.erro(this.extrairMensagemErro(err));
        this.carregandoVerificarInfo.set(false);
      },
      complete: () => this.carregandoVerificarInfo.set(false),
    });
  }

  /**
   * abrirSubmodalEditarDados()
   *
   * Abre o submodal de edição de dados pessoais (Tarefa 7.3) empilhado
   * sobre o modal de informações. Usa bootstrap.Modal.getOrCreateInstance
   * via ViewChild — mesmo padrão do modal de confirmação de encerramento
   * de cargo sobre o modal de cargos (evita race condition de backdrop duplo).
   */
  abrirSubmodalEditarDados(): void {
    const assoc = this.associadoParaEditar();
    if (!assoc) return;

    this.erroModalEditarDados.set(null);
    this.errosValidacaoEditarDados.set({});

    this.formEditarDados.patchValue({
      nomeCompleto:    assoc.nomeCompleto,
      emailPrincipal:  assoc.emailPrincipal,
      telefonePrincipal: assoc.telefonePrincipal,
      dataNascimento:  assoc.dataNascimento,
    });

    bootstrap.Modal.getOrCreateInstance(
      this.modalEditarDadosPessoaisRef.nativeElement
    ).show();
  }

  /**
   * salvarDadosPessoais()
   *
   * Submete o formulário de edição de dados pessoais.
   * Sucesso: fecha o submodal, atualiza associadoParaEditar() com o retorno
   * do backend (o modal de informações por baixo reflete os novos dados
   * imediatamente), exibe toast verde.
   */
  salvarDadosPessoais(): void {
    if (this.formEditarDados.invalid || !this.associadoParaEditar()) return;

    const id    = this.associadoParaEditar()!.idAssociado;
    const atual = this.associadoParaEditar()!;

    // Localiza o cargo ativo no signal cargosInfoAssociado e resolve o idCargoLideranca
    // via match de nomeCargo no catálogo. AssociadoCargoLiderancaResponseDto não expõe FK.
    const cargoAtivo     = this.cargosInfoAssociado().find(c => c.ativo);
    const cargoCatalogo  = cargoAtivo
      ? this.cargos().find(c => c.nomeCargo.trim().toLowerCase() === cargoAtivo.nomeCargo.trim().toLowerCase())
      : null;
    const primeiroEndereco = this.enderecosInfoAssociado()[0];

    const dto: AssociadoRequestDto = {
      nomeCompleto:                    this.formEditarDados.get('nomeCompleto')!.value as string,
      cpf:                             atual.cpf,
      emailPrincipal:                  this.formEditarDados.get('emailPrincipal')!.value as string,
      telefonePrincipal:               this.formEditarDados.get('telefonePrincipal')!.value as string,
      dataNascimento:                  this.formEditarDados.get('dataNascimento')!.value as string,
      dataIngresso:                    atual.dataIngresso,
      dataPagamentoPrimeiraAnuidade:   atual.dataPagamentoPrimeiraAnuidade,
      tipoOrigemEquipe:                atual.tipoOrigemEquipe,
      statusAssociado:                 atual.statusAssociado,
      idEquipeAtual:                   atual.idEquipeAtual,
      idEquipeOrigem:                  atual.idEquipeOrigem,
      idCluster:                       atual.idCluster,
      idAtuacaoEspecifica:             atual.idAtuacaoEspecifica,
      idPadrinho:                      atual.idPadrinho,
      idCargoLideranca:                cargoCatalogo?.idCargoLideranca ?? 0,
      dataInicioCargo:                 cargoAtivo?.dataInicio ?? this.obterDataHoje(),
      exibirAniversario:               this.visibilidadeInfoAssociado()?.exibirAniversario ?? false,
      rua:                             primeiroEndereco?.rua ?? '',
      numero:                          primeiroEndereco?.numero ?? '',
      complemento:                     primeiroEndereco?.complemento ?? null,
      bairro:                          primeiroEndereco?.bairro ?? '',
      cidade:                          primeiroEndereco?.cidade ?? '',
      estado:                          primeiroEndereco?.estado ?? '',
      cep:                             primeiroEndereco?.cep ?? '',
    };

    this.carregandoEditarDados.set(true);
    this.erroModalEditarDados.set(null);
    this.errosValidacaoEditarDados.set({});

    this.associadoService.editarAssociado(id, dto).subscribe({
      next: (atualizado) => {
        this.associadoParaEditar.set(atualizado);
        this.btnFecharModalEditarDadosPessoais.nativeElement.click();
        this.toastService.sucesso(`Dados de ${atualizado.nomeCompleto} atualizados com sucesso.`);
        this.carregarAssociados(this.paginaAtual());
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoEditarDados.set(this.normalizarErros(err.error.errors));
        }
        this.mostrarErroNaModal(this.erroModalEditarDados, this.extrairMensagemErro(err));
        this.carregandoEditarDados.set(false);
      },
      complete: () => this.carregandoEditarDados.set(false),
    });
  }

  /**
   * gerarFichaAssociado()
   *
   * Delega ao helper puro a geração e download do PDF da ficha do associado.
   * Recebe todos os dados já carregados pelo forkJoin (Tarefa 7.5).
   */
  gerarFichaAssociado(): void {
    const assoc = this.associadoParaEditar();
    if (!assoc) return;
    gerarPdfAssociado(
      assoc,
      this.cargosInfoAssociado(),
      this.enderecosInfoAssociado(),
      this.empresasInfoAssociado(),
      this.grupamentosInfoAssociado(),
      this.anuidadesInfoAssociado(),
      this.renovacoesInfoAssociado(),
      this.perfilInfoAssociado(),
    );
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE EQUIPE
  // =========================================================================

  /**
   * abrirModalEquipe(associado)
   *
   * Chamado pelo (click) do botão de equipe na tabela, antes do Bootstrap
   * exibir o modal. Não dispara nenhum GET — a lista de equipes já está
   * em this.equipes() (carregada no ngOnInit) e os dados do associado
   * vêm diretamente da linha clicada.
   *
   * patchValue() com emitEvent padrão (true) não é problema aqui porque
   * formEquipe não tem observers de valueChanges.
   */
  abrirModalEquipe(associado: AssociadoResponseDto): void {
    this.associadoParaEquipe.set(associado);
    this.erroModalEquipe.set(null);
    this.formEquipe.reset();

    // Pré-seleciona a equipe atual — o usuário precisa TROCAR para habilitar salvar
    this.formEquipe.patchValue({ idEquipe: associado.idEquipeAtual });
  }

  /**
   * salvarEquipe()
   *
   * Monta o AssociadoEditarEquipeRequestDto com o idEquipe selecionado
   * e faz PUT /api/v1/associados/{id}/equipe.
   *
   * Após sucesso: fecha modal + recarrega a página atual.
   * O backend retorna o AssociadoResponseDto atualizado (com o novo nomeEquipe).
   */
  salvarEquipe(): void {
    const associado = this.associadoParaEquipe();
    if (!associado) return;

    this.carregandoModalEquipe.set(true);
    this.erroModalEquipe.set(null);

    const val = this.formEquipe.getRawValue();
    const dto: AssociadoEditarEquipeRequestDto = { idEquipe: Number(val.idEquipe) };

    this.associadoService.editarEquipeAssociado(associado.idAssociado, dto).subscribe({
      next: () => {
        this.btnFecharEquipe.nativeElement.click();
        this.carregarAssociados(this.paginaAtual());
        this.toastService.sucesso('Equipe do associado atualizada com sucesso!');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao transferir equipe do associado:', err);
        this.mostrarErroNaModal(this.erroModalEquipe, this.extrairMensagemErro(err));
        this.carregandoModalEquipe.set(false);
      },
      complete: () => {
        this.carregandoModalEquipe.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE ENDEREÇO RESIDENCIAL
  // =========================================================================

  /**
   * abrirModalEndereco(associado)
   *
   * Chamado pelo (click) do botão de endereço na tabela.
   * Carrega a lista de endereços residenciais e abre o modal apenas após o GET
   * concluir — mesmo padrão de abrirModalCargo e abrirModalEmpresa.
   *
   * Por que não usa data-bs-toggle?
   * Em caso de erro de rede, o modal não abre e o usuário recebe um toast.
   * Evita que ele veja o modal "fantasma" com header preenchido e body vazio.
   *
   * Não usa forkJoin — apenas uma requisição, sem dados de suporte adicionais.
   */
  abrirModalEndereco(associado: AssociadoResponseDto): void {
    this.associadoParaEndereco.set(associado);
    this.erroModalEndereco.set(null);
    this.errosValidacaoEndereco.set({});
    this.modoFormEndereco.set(null);
    this.enderecoParaEditar.set(null);
    this.enderecosDoAssociado.set([]);
    this.carregandoVerificarEndereco.set(true);

    this.associadoService.listarEnderecosResidenciais(associado.idAssociado).subscribe({
      next: (enderecos) => {
        this.enderecosDoAssociado.set(enderecos);
        this.carregandoVerificarEndereco.set(false);
        bootstrap.Modal.getOrCreateInstance(this.modalEnderecoRef.nativeElement).show();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar endereços residenciais:', err);
        this.carregandoVerificarEndereco.set(false);
        this.toastService.erro('Erro ao carregar endereços. Tente novamente.');
        // Modal não é aberto — usuário recebe feedback via toast
      },
    });
  }

  /**
   * ativarFormNovoEndereco()
   *
   * Exibe o formulário em branco para adicionar um novo endereço (POST).
   * Chamado pelo botão "Adicionar Novo Endereço" na fase de lista.
   */
  ativarFormNovoEndereco(): void {
    this.enderecoParaEditar.set(null);
    this.formEndereco.reset();
    this.erroModalEndereco.set(null);
    this.errosValidacaoEndereco.set({});
    this.modoFormEndereco.set('novo');
  }

  /**
   * ativarFormEditarEndereco(endereco)
   *
   * Exibe o formulário pré-preenchido para editar um endereço existente (PUT).
   * Chamado pelo botão "Editar" de cada linha na lista de endereços.
   *
   * patchValue() com { emitEvent: false } — não dispara validações prematuras.
   * O botão "Salvar" só habilita quando o usuário modificar ao menos um campo (form.dirty).
   */
  ativarFormEditarEndereco(endereco: EnderecoResidencialResponseDto): void {
    this.enderecoParaEditar.set(endereco);
    this.erroModalEndereco.set(null);
    this.errosValidacaoEndereco.set({});
    this.formEndereco.patchValue({
      rua:         endereco.rua,
      numero:      endereco.numero,
      complemento: endereco.complemento,
      bairro:      endereco.bairro,
      cidade:      endereco.cidade,
      estado:      endereco.estado,
      cep:         endereco.cep,
    }, { emitEvent: false });
    this.modoFormEndereco.set('editar');
  }

  /**
   * cancelarFormEndereco()
   *
   * Volta para a fase de lista sem salvar.
   * Chamado pelo botão "Cancelar" no formulário de novo/edição.
   */
  cancelarFormEndereco(): void {
    this.modoFormEndereco.set(null);
    this.enderecoParaEditar.set(null);
    this.erroModalEndereco.set(null);
    this.errosValidacaoEndereco.set({});
  }

  /**
   * copiarEndereco(endereco)
   *
   * Formata o endereço via helper e grava no clipboard do usuário.
   * Exibe feedback visual no botão copiado por 2 segundos (mesmo padrão
   * do modal de equipe — idEnderecoCopiado controla qual card mudou).
   */
  copiarEndereco(endereco: EnderecoResidencialResponseDto): void {
    const texto = formatarEnderecoResidencial(endereco);
    navigator.clipboard.writeText(texto).then(() => {
      this.idEnderecoCopiado.set(endereco.idEndereco);
      setTimeout(() => this.idEnderecoCopiado.set(null), 2000);
    });
  }

  /**
   * salvarEndereco()
   *
   * Monta o EnderecoResidencialRequestDto e chama POST ou PUT conforme o modo:
   *   'novo'   → POST /api/v1/enderecos-residenciais/associado/{idAssociado}
   *   'editar' → PUT  /api/v1/enderecos-residenciais/{idEndereco}
   *
   * Após sucesso:
   *   - Recarrega a lista de endereços (GET) para refletir o novo/editado
   *   - Volta para a fase de lista (modoFormEndereco = null)
   *   - O modal permanece aberto — o usuário pode adicionar mais endereços
   */
  salvarEndereco(): void {
    const associado = this.associadoParaEndereco();
    if (!associado) return;

    this.carregandoModalEndereco.set(true);
    this.erroModalEndereco.set(null);
    this.errosValidacaoEndereco.set({});

    const val = this.formEndereco.getRawValue();
    const dto: EnderecoResidencialRequestDto = {
      rua:         val.rua?.trim(),
      numero:      val.numero?.trim(),
      complemento: val.complemento?.trim() || null,
      bairro:      val.bairro?.trim(),
      cidade:      val.cidade?.trim(),
      estado:      (val.estado as string).toUpperCase().trim(),
      cep:         (val.cep as string).replace(/\D/g, ''),
    };

    const modo     = this.modoFormEndereco();
    const endereco = this.enderecoParaEditar();

    // Escolhe POST ou PUT conforme o modo atual
    const operacao$ = modo === 'editar' && endereco
      ? this.associadoService.editarEnderecoResidencial(endereco.idEndereco, dto)
      : this.associadoService.cadastrarEnderecoResidencial(associado.idAssociado, dto);

    operacao$.subscribe({
      next: () => {
        // Recarrega a lista para refletir a alteração
        this.associadoService.listarEnderecosResidenciais(associado.idAssociado).subscribe({
          next:  (enderecos) => this.enderecosDoAssociado.set(enderecos),
          error: (err)       => console.error('Erro ao recarregar endereços:', err),
        });
        // Volta para a lista sem fechar o modal
        this.modoFormEndereco.set(null);
        this.enderecoParaEditar.set(null);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao salvar endereço residencial:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoEndereco.set(this.normalizarErros(err.error.errors));
          this.mostrarErroNaModal(this.erroModalEndereco, 'Corrija os campos destacados.');
        } else {
          this.mostrarErroNaModal(this.erroModalEndereco, this.extrairMensagemErro(err));
        }
        this.carregandoModalEndereco.set(false);
      },
      complete: () => {
        this.carregandoModalEndereco.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — CONFIRMAÇÃO DE CADASTRO (Bloco 5)
  // =========================================================================

  /**
   * abrirConfirmacaoAtivacao(associado)
   *
   * Chamado pelo (click) do botão "Confirmar cadastro" na tabela, antes do
   * Bootstrap exibir o modal. Registra o associado clicado e reseta o erro.
   */
  abrirConfirmacaoAtivacao(associado: AssociadoResponseDto): void {
    this.associadoParaConfirmar.set(associado);
    this.erroConfirmacao.set(null);
  }

  /**
   * confirmarAtivacao()
   *
   * Executa o PATCH /api/v1/associados/{id}/confirmar-cadastro.
   * Transição PREATIVO → ATIVO.
   *
   * Após sucesso:
   *   - Fecha o modal via ViewChild (botão oculto com data-bs-dismiss)
   *   - Recarrega a página atual da listagem
   *   - Exibe o alerta verde flutuante com o nome do associado por 3s
   */
  confirmarAtivacao(): void {
    const associado = this.associadoParaConfirmar();
    if (!associado) return;

    this.carregandoConfirmacao.set(true);
    this.erroConfirmacao.set(null);

    this.associadoService.confirmarCadastro(associado.idAssociado).subscribe({
      next: () => {
        this.btnFecharConfirmacao.nativeElement.click();
        this.carregarAssociados(this.paginaAtual());
        this.toastService.sucesso(`${associado.nomeCompleto} foi ativado com sucesso!`);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao confirmar cadastro:', err);
        this.mostrarErroNaModal(this.erroConfirmacao, this.extrairMensagemErro(err));
        this.carregandoConfirmacao.set(false);
      },
      complete: () => {
        this.carregandoConfirmacao.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — ALTERAR STATUS (Bloco 5.2)
  // =========================================================================

  /**
   * abrirModalAlterarStatus(associado)
   *
   * Registra o associado clicado, reseta o formulário e limpa o signal
   * de status selecionado para garantir que nenhum campo condicional
   * apareça na abertura do modal.
   * O Bootstrap abre o modal via data-bs-toggle no botão da tabela.
   */
  abrirModalAlterarStatus(associado: AssociadoResponseDto): void {
    this.associadoParaAlterarStatus.set(associado);
    this.erroModalAlterarStatus.set(null);
    this.errosValidacaoAlterarStatus.set({});
    this.statusNovoSelecionado.set(null);
    this.formAlterarStatus.reset();
  }

  /**
   * salvarAlteracaoStatus()
   *
   * Monta o AssociadoAlterarStatusRequestDto e executa PATCH.
   * idRegistradoPor vem do usuário logado via AuthService (idAssociado).
   * Campos condicionais são enviados conforme o status: os não aplicáveis
   * ficam null (o backend valida e ignora campos proibidos).
   *
   * Após sucesso: fecha modal + toast descritivo + reload da página atual.
   */
  salvarAlteracaoStatus(): void {
    const associado = this.associadoParaAlterarStatus();
    if (!associado) return;

    this.carregandoAlterarStatus.set(true);
    this.erroModalAlterarStatus.set(null);

    const val = this.formAlterarStatus.getRawValue();

    const dto: AssociadoAlterarStatusRequestDto = {
      statusNovo:          val.statusNovo,
      motivo:              val.motivo?.trim() || null,
      dataInicioPausa:     val.dataInicioPausa     || null,
      dataPrevisaoRetorno: val.dataPrevisaoRetorno  || null,
      idRegistradoPor:     this.authService.usuario()?.idAssociado ?? 0,
    };

    this.associadoService.alterarStatus(associado.idAssociado, dto).subscribe({
      next: () => {
        this.btnFecharAlterarStatus.nativeElement.click();
        this.carregarAssociados(this.paginaAtual());
        const novoLabel = this.LABELS_STATUS[val.statusNovo as StatusAssociado] ?? val.statusNovo;
        this.toastService.sucesso(
          `Status de ${associado.nomeCompleto} alterado para "${novoLabel}" com sucesso!`
        );
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao alterar status:', err);
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoAlterarStatus.set(this.normalizarErros(err.error.errors));
          this.mostrarErroNaModal(this.erroModalAlterarStatus, 'Corrija os campos destacados.');
        } else {
          this.mostrarErroNaModal(this.erroModalAlterarStatus, this.extrairMensagemErro(err));
        }
        this.carregandoAlterarStatus.set(false);
      },
      complete: () => this.carregandoAlterarStatus.set(false),
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — RENOVAR ANUIDADE (Bloco 5.3)
  // =========================================================================

  /**
   * abrirModalRenovar(associado)
   *
   * Registra o associado clicado e pré-preenche dataPagamento com hoje.
   * O modal exibe o nome e vencimento atual do associado para contexto.
   */
  abrirModalRenovar(associado: AssociadoResponseDto): void {
    this.associadoParaRenovar.set(associado);
    this.erroModalRenovar.set(null);
    this.errosValidacaoRenovar.set({});
    this.formRenovar.reset({ dataPagamento: this.obterDataHoje() });
  }

  /**
   * salvarRenovacao()
   *
   * Executa PATCH /renovar-anuidade com { dataPagamento }.
   * O backend calcula o novo vencimento (+ 12 meses) e retorna o
   * AssociadoResponseDto atualizado — usamos dataVencimento do retorno
   * para exibir o novo vencimento no toast.
   *
   * Erros 422 comuns tratados pelo extrairMensagemErro():
   *   - "Cadastro ainda não confirmado."
   *   - "Associado isento de anuidade."
   */
  salvarRenovacao(): void {
    const associado = this.associadoParaRenovar();
    if (!associado) return;

    this.carregandoRenovar.set(true);
    this.erroModalRenovar.set(null);

    const val = this.formRenovar.getRawValue();
    const dto: AssociadoRenovarAnuidadeRequestDto = { dataPagamento: val.dataPagamento };

    this.associadoService.renovarAnuidade(associado.idAssociado, dto).subscribe({
      next: (atualizado) => {
        this.btnFecharRenovar.nativeElement.click();
        this.carregarAssociados(this.paginaAtual());
        const novoVencimento = this.formatarData(atualizado.dataVencimento);
        this.toastService.sucesso(
          `Anuidade de ${associado.nomeCompleto} renovada! Novo vencimento: ${novoVencimento}.`
        );
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400 && err.error?.errors) {
          this.errosValidacaoRenovar.set(this.normalizarErros(err.error.errors));
          this.mostrarErroNaModal(this.erroModalRenovar, 'Corrija os campos destacados.');
        } else {
          this.mostrarErroNaModal(this.erroModalRenovar, this.extrairMensagemErro(err));
        }
        this.carregandoRenovar.set(false);
      },
      complete: () => this.carregandoRenovar.set(false),
    });
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — MODAL DE EMPRESA (Bloco 6)
  // =========================================================================

  /**
   * abrirModalEmpresa(associado)
   *
   * Chamado pelo (click) do botão "Empresa" na tabela.
   * Carrega todas as empresas do associado via GET e abre o modal na Fase 1
   * (lista), independentemente de haver empresas ou não.
   *
   * Por que não usa data-bs-toggle?
   * Precisa fazer o GET antes de abrir para já ter os dados da lista prontos.
   * O spinner fica no botão da tabela (carregandoVerificarEmpresa) durante a espera.
   */
  abrirModalEmpresa(associado: AssociadoResponseDto): void {
    this.associadoParaEmpresa.set(associado);
    this.empresasDoAssociado.set([]);
    this.modoFormEmpresa.set(null);
    this.erroModalEmpresa.set(null);
    this.errosValidacaoEmpresa.set({});
    this.carregandoVerificarEmpresa.set(true);

    this.empresaService.buscarEmpresaPorAssociado(associado.idAssociado).subscribe({
      next: ({ items }) => {
        this.empresasDoAssociado.set(items);
        this.carregandoVerificarEmpresa.set(false);
        bootstrap.Modal.getOrCreateInstance(this.modalEmpresaRef.nativeElement).show();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar empresas do associado:', err);
        this.carregandoVerificarEmpresa.set(false);
        // Silencioso: o botão volta ao estado normal sem abrir o modal
      },
    });
  }

  /**
   * ativarFormNovaEmpresa()
   *
   * Transição Fase 1 → Fase 2 (novo).
   * Reseta o formulário e exibe os campos vazios para cadastro.
   */
  ativarFormNovaEmpresa(): void {
    this.idEmpresaAtual.set(null);
    this.idEnderecoComercialAtual.set(null);
    this.formEmpresa.reset();
    this.errosValidacaoEmpresa.set({});
    this.modoFormEmpresa.set('novo');
  }

  /**
   * ativarFormEditarEmpresa(empresa)
   *
   * Transição Fase 1 → Fase 2 (editar).
   * Busca o endereço comercial da empresa (GET), pré-preenche o formulário
   * via patchValue e exibe o spinner enquanto o dado carrega.
   *
   * O patchValue usa emitEvent:false para não marcar o form como dirty —
   * o botão "Salvar" só habilita quando o usuário modificar algo.
   */
  ativarFormEditarEmpresa(empresa: EmpresaResponseDto): void {
    this.idEmpresaAtual.set(empresa.idEmpresa);
    this.errosValidacaoEmpresa.set({});
    this.carregandoEdicaoEmpresa.set(true);
    this.modoFormEmpresa.set('editar');

    this.empresaService.buscarEnderecoPorEmpresa(empresa.idEmpresa).subscribe({
      next: (end) => {
        this.idEnderecoComercialAtual.set(end.idEnderecoComercial);
        this.formEmpresa.patchValue({
          razaoSocial:  empresa.razaoSocial,
          cnpj:         empresa.cnpj,
          nomeFantasia: empresa.nomeFantasia,
          rua:          end.rua,
          numero:       end.numero,
          complemento:  end.complemento,
          bairro:       end.bairro,
          cidade:       end.cidade,
          estado:       end.estado,
          cep:          end.cep,
        }, { emitEvent: false });
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erro ao carregar endereço da empresa:', err);
        this.mostrarErroNaModal(this.erroModalEmpresa, 'Erro ao carregar dados. Tente novamente.');
        this.modoFormEmpresa.set(null);
        this.carregandoEdicaoEmpresa.set(false);
      },
      complete: () => this.carregandoEdicaoEmpresa.set(false),
    });
  }

  /**
   * cancelarFormEmpresa()
   *
   * Transição Fase 2 → Fase 1 sem salvar.
   * Reseta o formulário e volta para a lista de empresas.
   */
  cancelarFormEmpresa(): void {
    this.modoFormEmpresa.set(null);
    this.errosValidacaoEmpresa.set({});
    this.formEmpresa.reset();
  }

  /**
   * salvarEmpresa()
   *
   * Chamado pelo (click) do botão "Salvar" no modal de empresa.
   * Delega para POST (novo) ou dois PUTs paralelos (editar) conforme modoFormEmpresa().
   *
   * NOVO    → POST /api/v1/empresas com EmpresaCadastroRequestDto
   *           (backend persiste empresa + endereço atomicamente)
   *
   * EDITAR  → forkJoin:
   *   PUT /api/v1/empresas/{idEmpresa}               com EmpresaRequestDto
   *   PUT /api/v1/enderecos-comerciais/{idEndereco}  com EmpresaEnderecoComercialRequestDto
   *
   * Pós-sucesso: atualiza a lista local e volta para a Fase 1.
   * O modal NÃO fecha — o usuário pode cadastrar ou editar várias empresas.
   */
  salvarEmpresa(): void {
    const associado = this.associadoParaEmpresa();
    if (!associado) return;

    this.carregandoModalEmpresa.set(true);
    this.erroModalEmpresa.set(null);
    this.errosValidacaoEmpresa.set({});

    const val = this.formEmpresa.getRawValue();

    if (this.modoFormEmpresa() === 'novo') {
      // ── NOVO: POST atômico com empresa + endereço ──────────────────────
      const dto: EmpresaCadastroRequestDto = {
        idAssociado:  associado.idAssociado,
        razaoSocial:  val.razaoSocial?.trim(),
        cnpj:         (val.cnpj as string).replace(/\D/g, ''),
        nomeFantasia: val.nomeFantasia?.trim() || null,
        rua:          val.rua?.trim(),
        numero:       val.numero?.trim(),
        complemento:  val.complemento?.trim() || null,
        bairro:       val.bairro?.trim(),
        cidade:       val.cidade?.trim(),
        estado:       (val.estado as string).toUpperCase().trim(),
        cep:          (val.cep as string).replace(/\D/g, ''),
      };

      this.empresaService.cadastrarEmpresaComEndereco(dto).subscribe({
        next: (novaEmpresa) => {
          // Adiciona à lista sem fechar o modal — volta para a Fase 1
          this.empresasDoAssociado.update(lista => [...lista, novaEmpresa]);
          this.modoFormEmpresa.set(null);
          this.toastService.sucesso('Empresa cadastrada com sucesso!');
        },
        error: (err: HttpErrorResponse) => this.tratarErroModalEmpresa(err),
        complete: () => this.carregandoModalEmpresa.set(false),
      });

    } else {
      // ── EDITAR: dois PUTs paralelos via forkJoin ───────────────────────
      const idEmpresa  = this.idEmpresaAtual();
      const idEndereco = this.idEnderecoComercialAtual();
      if (!idEmpresa || !idEndereco) {
        this.mostrarErroNaModal(this.erroModalEmpresa, 'IDs não encontrados. Feche e reabra o modal.');
        this.carregandoModalEmpresa.set(false);
        return;
      }

      const dtoEmpresa: EmpresaRequestDto = {
        idAssociado:  associado.idAssociado,
        razaoSocial:  val.razaoSocial?.trim(),
        cnpj:         (val.cnpj as string).replace(/\D/g, ''),
        nomeFantasia: val.nomeFantasia?.trim() || null,
      };

      const dtoEndereco: EmpresaEnderecoComercialRequestDto = {
        idEmpresa,
        rua:          val.rua?.trim(),
        numero:       val.numero?.trim(),
        complemento:  val.complemento?.trim() || null,
        bairro:       val.bairro?.trim(),
        cidade:       val.cidade?.trim(),
        estado:       (val.estado as string).toUpperCase().trim(),
        cep:          (val.cep as string).replace(/\D/g, ''),
      };

      forkJoin({
        empresa:  this.empresaService.editarEmpresa(idEmpresa, dtoEmpresa),
        endereco: this.empresaService.editarEndereco(idEndereco, dtoEndereco),
      }).subscribe({
        next: ({ empresa: emp }) => {
          // Atualiza o item na lista sem fechar o modal — volta para a Fase 1
          this.empresasDoAssociado.update(lista =>
            lista.map(e => e.idEmpresa === emp.idEmpresa ? emp : e)
          );
          this.modoFormEmpresa.set(null);
          this.toastService.sucesso('Empresa atualizada com sucesso!');
        },
        error: (err: HttpErrorResponse) => this.tratarErroModalEmpresa(err),
        complete: () => this.carregandoModalEmpresa.set(false),
      });
    }
  }

  // =========================================================================
  // MÉTODOS PÚBLICOS — AUTOCOMPLETE DE PADRINHO
  // =========================================================================

  /**
   * atualizarNomePadrinho(valor)
   *
   * Emite o valor atual para o padrinhoSubject (que tem debounce 300ms).
   * Limpa a seleção anterior ao digitar — o idPadrinhoSelecionado só é
   * preenchido quando o usuário clica em uma sugestão.
   */
  atualizarNomePadrinho(valor: string): void {
    this.nomePadrinhoInput.set(valor);
    this.idPadrinhoSelecionado.set(null); // limpa seleção ao digitar
    this.padrinhoSubject.next(valor);
  }

  /**
   * selecionarPadrinho(assoc)
   *
   * Chamado ao clicar em um item da lista de sugestões.
   * Armazena o idAssociado e fecha o dropdown.
   */
  selecionarPadrinho(assoc: AssociadoResponseDto): void {
    this.idPadrinhoSelecionado.set(assoc.idAssociado);
    this.nomePadrinhoInput.set(`${assoc.nomeCompleto} — ${this.mascararCpf(assoc.cpf)}`);
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
    this.erroPadrinho.set(null);
  }

  /**
   * fecharSugestoesPadrinho()
   *
   * Chamado pelo evento (blur) do input de padrinho.
   * O delay de 200ms permite que o evento (mousedown) das sugestões
   * dispare antes do fechamento, preservando o clique nas sugestões.
   */
  fecharSugestoesPadrinho(): void {
    setTimeout(() => this.mostrarSugestoesPadrinho.set(false), 200);
  }

  /**
   * limparPadrinho()
   *
   * Remove o padrinho selecionado e limpa o campo de busca.
   * Chamado pelo botão ✕ que aparece quando há um padrinho selecionado.
   */
  limparPadrinho(): void {
    this.idPadrinhoSelecionado.set(null);
    this.nomePadrinhoInput.set('');
    this.sugestoesPadrinho.set([]);
    this.mostrarSugestoesPadrinho.set(false);
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — CARGA DE DADOS
  // =========================================================================

  /**
   * carregarAssociados(page)
   *
   * Chama o service com os filtros ativos no momento da chamada.
   * É o único ponto que acessa o backend para listagem — filtros,
   * paginação e recargas de modal sempre passam por aqui.
   */
  private carregarAssociados(page: number = 0): void {
    this.carregandoLista.set(true);
    this.paginaAtual.set(page);

    const status = this.filtroStatus();
    this.associadoService.listarAssociados(page, this.tamanhoPagina(), {
      nome:     this.termoBusca(),
      status:   status !== 'Todos' ? status : undefined,
      idEquipe: this.filtroEquipeId() ?? undefined,
    }).subscribe({
      next: (response) => {
        this.associados.set(response.items);
        this.totalAssociados.set(response.totalItems);
        this.totalPaginas.set(response.totalPages);
        this.temProxima.set(response.hasNext);
        this.temAnterior.set(response.hasPrevious);
      },
      error: (erro: HttpErrorResponse) => {
        console.error('Erro ao carregar associados:', erro);
        this.carregandoLista.set(false);
      },
      complete: () => {
        this.carregandoLista.set(false);
      },
    });
  }

  /**
   * carregarEquipes()
   *
   * Carrega lista de equipes para o select de filtro (listagem) e para o
   * select de equipe dentro do modal de cadastro.
   * Usa size=100 para trazer todas as equipes em uma única requisição.
   */
  private carregarEquipes(): void {
    this.equipeService.listarEquipes(0, 100).subscribe({
      next: (response) => this.equipes.set(response.items),
      error: (err) => console.error('Erro ao carregar equipes:', err),
    });
  }

  /**
   * carregarDadosModal() — Tarefa 3.1
   *
   * Carrega em paralelo os dados necessários para os dropdowns do modal
   * (clusters e cargos). Equipes já estão disponíveis via this.equipes().
   *
   * forkJoin: dispara as duas requisições simultâneas e aguarda ambas
   * completarem antes de atualizar os signals. Garante que o formulário
   * só fica acessível com os dados prontos.
   */
  private carregarDadosModal(): void {
    // Se os dados já foram carregados (reabertura do modal), não recarrega
    if (this.clusters().length > 0 && this.cargos().length > 0) return;

    this.carregandoDadosModal.set(true);

    forkJoin({
      clusters: this.clusterService.listarClusters(0, 100),
      cargos:   this.cargoService.listar(0, 100),
    }).subscribe({
      next: ({ clusters, cargos }) => {
        this.clusters.set(clusters.items);
        // Filtra apenas cargos ativos para o select
        this.cargos.set(cargos.items.filter(c => c.ativo));
        // Pré-seleciona "Associado" automaticamente no campo fixo
        this.aplicarCargoAssociado();
      },
      error: (err: HttpErrorResponse) => {
        this.erroModal.set('Erro ao carregar os dados do formulário. Feche e tente novamente.');
        console.error('Erro no forkJoin do modal:', err);
        this.carregandoDadosModal.set(false);
      },
      complete: () => {
        this.carregandoDadosModal.set(false);
      },
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — OBSERVADORES REATIVOS
  // =========================================================================

  /**
   * criarFormEdicao()
   *
   * Factory do FormGroup do modal de edição. Campos que NÃO aparecem aqui:
   *   - dataIngresso       → imutável; lido de associadoParaEditar() no submit
   *   - idPadrinho         → imutável; lido de associadoParaEditar() no submit
   *   - idCargoLideranca   → cargo silencioso; lido de idCargoSilencioso() no submit
   *   - tipoOrigemEquipe   → imutável; lido de associadoParaEditar() no submit
   *   - statusAssociado    → alterado via modal próprio (Bloco 5)
   *
   * CPF: disabled — visível para identificação do associado, mas não editável.
   * getRawValue() o lê mesmo com disabled:true para incluir no PUT.
   *
   * idAtuacaoEspecifica: começa disabled, igual ao cadastro.
   * observarClusterEdicao() habilita quando o usuário seleciona um cluster.
   */
  private criarFormEdicao(): FormGroup {
    return this.fb.group({
      // ── Dados pessoais ───────────────────────────────────────────────────
      nomeCompleto:      ['', Validators.required],
      cpf:               [{ value: '', disabled: true }], // identificação, não editável
      emailPrincipal:    ['', [Validators.required, Validators.email]],
      telefonePrincipal: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      dataNascimento:    ['', [Validators.required, validarIdadeMinima16Anos]],

      // ── Dados administrativos ────────────────────────────────────────────
      dataPagamentoPrimeiraAnuidade: [null], // opcional
      exibirAniversario:             [false],

      // ── Endereço residencial ─────────────────────────────────────────────
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      estado:      ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * observarCluster() — Tarefa 3.3
   *
   * Observa mudanças no select de Cluster e:
   *   1. Desabilita/habilita o select de Atuação Específica.
   *   2. Carrega as atuações correspondentes ao cluster selecionado.
   *   3. Reseta a atuação selecionada ao trocar de cluster.
   *
   * Por que disable()/enable()?
   * Ao desabilitar via FormControl, o Angular remove automaticamente
   * a validação required da atuação, evitando que o form fique inválido
   * sem cluster selecionado. getRawValue() ainda lê o valor quando necessário.
   */
  private observarCluster(): void {
    const atuacaoControl = this.formCadastro.get('idAtuacaoEspecifica')!;

    // Começa desabilitado (nenhum cluster selecionado ao iniciar)
    atuacaoControl.disable();

    this.formCadastro.get('idCluster')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((idCluster: string | null) => {
        // Reseta a atuação ao trocar de cluster
        atuacaoControl.reset(null);
        this.atuacoes.set([]);

        if (!idCluster) {
          atuacaoControl.disable();
          return;
        }

        atuacaoControl.enable();

        this.clusterService.listarAtuacoesPorCluster(Number(idCluster), 0, 100).subscribe({
          next: (response) => this.atuacoes.set(response.items),
          error: (err) => console.error('Erro ao carregar atuações do cluster:', err),
        });
      });
  }

  /**
   * observarPadrinho() — Tarefa 3.3
   *
   * Gerencia o autocomplete do campo Padrinho com debounce de 300ms e
   * cancelamento de requisições anteriores via switchMap.
   *
   * Fluxo:
   *   1. Usuário digita → atualizarNomePadrinho() → padrinhoSubject.next()
   *   2. debounceTime(300) aguarda pausa de 300ms no digitação
   *   3. switchMap cancela a requisição anterior e dispara nova busca
   *   4. Resultado popula sugestoesPadrinho e exibe o dropdown
   */
  private observarPadrinho(): void {
    this.padrinhoSubject.pipe(
      debounceTime(300),
      switchMap((termo: string) => {
        const termLimpo = termo.trim();

        // Menos de 2 caracteres: limpa as sugestões sem chamar o backend
        if (termLimpo.length < 2) {
          this.buscandoPadrinho.set(false);
          this.mostrarSugestoesPadrinho.set(false);
          this.sugestoesPadrinho.set([]);
          return of(null);
        }

        this.buscandoPadrinho.set(true);

        // of(null) é retornado em caso de erro — não quebra o pipe
        return this.associadoService
          .listarAssociados(0, 8, { nome: termLimpo })
          .pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (response === null) {
        this.buscandoPadrinho.set(false);
        return;
      }
      this.sugestoesPadrinho.set(response.items);
      this.mostrarSugestoesPadrinho.set(response.items.length > 0);
      this.buscandoPadrinho.set(false);
    });
  }

  // =========================================================================
  // MÉTODOS PRIVADOS — HELPERS
  // =========================================================================

  /**
   * criarFormCargo()
   *
   * Factory do FormGroup do modal de atribuição de cargo.
   * Dois campos apenas: cargo (select obrigatório) e data de início.
   * dataInicio segue a mesma regra do cadastro: não pode ser futura.
   */
  private criarFormCargo(): FormGroup {
    return this.fb.group({
      idCargoLideranca: [null, Validators.required],
      dataInicio:       [this.obterDataHoje(), [Validators.required, validarDataNaoFutura]],
    });
  }

  /**
   * criarFormEquipe()
   *
   * Factory do FormGroup do modal de equipe. Campo único: idEquipe.
   * Começa com null — preenchido via patchValue() ao abrir o modal.
   * O campo é obrigatório para que o select em branco bloqueie o salvar.
   */
  private criarFormEquipe(): FormGroup {
    return this.fb.group({
      idEquipe: [null, Validators.required],
    });
  }

  /**
   * criarFormEndereco()
   *
   * Factory do FormGroup do modal de endereço residencial.
   * Compartilhado entre criação (reset) e edição (patchValue).
   * CEP: apenas 8 dígitos (sem hífen) — mesmo padrão do cadastro e edição.
   */
  private criarFormEndereco(): FormGroup {
    return this.fb.group({
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      estado:      ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * criarFormAlterarStatus()
   *
   * Factory do FormGroup do modal de alteração de status.
   * Os três campos condicionais começam sem Validators.required —
   * o observarStatusAlteracao() adiciona/remove os validators em runtime
   * conforme o status selecionado.
   */
  private criarFormAlterarStatus(): FormGroup {
    return this.fb.group({
      statusNovo:          [null, Validators.required],
      motivo:              [null],              // required para DESISTENCIA / DESLIGADO
      dataInicioPausa:     [null],              // required para PAUSA_PROGRAMADA
      dataPrevisaoRetorno: [null],              // required para PAUSA_PROGRAMADA
    });
  }

  /**
   * observarStatusAlteracao()
   *
   * Reage às mudanças do select statusNovo:
   *   1. Atualiza statusNovoSelecionado() para o template reagir com @if.
   *   2. Reseta os campos condicionais (evita enviar dados de uma seleção anterior).
   *   3. Adiciona/remove Validators.required nos campos correspondentes.
   *
   * Lógica de validators por status (conforme PRD §9.1 / GUIA §9.1):
   *   INATIVO_PAUSA_PROGRAMADA  → dataInicioPausa + dataPrevisaoRetorno obrigatórios
   *   INATIVO_DESISTENCIA       → motivo obrigatório
   *   INATIVO_DESLIGADO         → motivo obrigatório
   *   ATIVO / INATIVO_FALECIMENTO / INATIVO_OUTRO → sem campos obrigatórios extras
   */
  private observarStatusAlteracao(): void {
    const motivoCtrl       = this.formAlterarStatus.get('motivo')!;
    const inicioPausaCtrl  = this.formAlterarStatus.get('dataInicioPausa')!;
    const retornoCtrl      = this.formAlterarStatus.get('dataPrevisaoRetorno')!;

    this.formAlterarStatus.get('statusNovo')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status: StatusAssociado | null) => {
        this.statusNovoSelecionado.set(status);

        // Reseta campos condicionais e remove validators anteriores
        motivoCtrl.reset(null);
        inicioPausaCtrl.reset(null);
        retornoCtrl.reset(null);
        motivoCtrl.removeValidators(Validators.required);
        inicioPausaCtrl.removeValidators(Validators.required);
        retornoCtrl.removeValidators(Validators.required);

        if (status === 'INATIVO_PAUSA_PROGRAMADA') {
          inicioPausaCtrl.addValidators(Validators.required);
          retornoCtrl.addValidators(Validators.required);
        } else if (status === 'INATIVO_DESISTENCIA' || status === 'INATIVO_DESLIGADO') {
          motivoCtrl.addValidators(Validators.required);
        }
        // ATIVO, INATIVO_FALECIMENTO, INATIVO_OUTRO: motivo aparece mas opcional

        motivoCtrl.updateValueAndValidity();
        inicioPausaCtrl.updateValueAndValidity();
        retornoCtrl.updateValueAndValidity();
      });

    // Quando o usuário muda a data de início da pausa, limpa a previsão de
    // retorno caso ela já tenha sido preenchida com uma data anterior à nova
    // data de início — evita que um valor inválido passe despercebido.
    inicioPausaCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((novoInicio: string | null) => {
        const retornoAtual = retornoCtrl.value as string | null;
        if (novoInicio && retornoAtual && retornoAtual < novoInicio) {
          retornoCtrl.reset(null);
        }
      });
  }

  /**
   * criarFormRenovar()
   *
   * Factory do FormGroup do modal de renovação de anuidade.
   * Um único campo: dataPagamento (pré-preenchido com hoje em abrirModalRenovar).
   * Não usa validarDataNaoFutura — o pagamento pode ser confirmado no dia atual.
   */
  private criarFormRenovar(): FormGroup {
    return this.fb.group({
      dataPagamento: [this.obterDataHoje(), Validators.required],
    });
  }

  /**
   * criarFormEmpresa()
   *
   * Factory do FormGroup do modal de empresa.
   * Dois painéis lógicos num único FormGroup:
   *   Painel A — dados da empresa: razaoSocial, cnpj, nomeFantasia
   *   Painel B — endereço comercial: rua, numero, complemento, bairro, cidade, estado, cep
   *
   * Compartilhado entre cadastro (reset) e edição (patchValue com emitEvent:false).
   * CNPJ: 14 dígitos sem pontuação — máscara removida no submit.
   * CEP:  8 dígitos sem hífen — mesmo padrão dos outros formulários do projeto.
   */
  private criarFormEmpresa(): FormGroup {
    return this.fb.group({
      // ── Painel A — Empresa ───────────────────────────────────────────────
      razaoSocial:  ['', Validators.required],
      cnpj:         ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      nomeFantasia: [null], // opcional
      // ── Painel B — Endereço Comercial ────────────────────────────────────
      rua:          ['', Validators.required],
      numero:       ['', Validators.required],
      complemento:  [null], // opcional
      bairro:       ['', Validators.required],
      cidade:       ['', Validators.required],
      estado:       ['', [Validators.required, Validators.maxLength(2)]],
      cep:          ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * tratarErroModalEmpresa(err)
   *
   * Centraliza o tratamento de erros do modal de empresa.
   * Cobre os três casos mais frequentes:
   *   400 com errors → erros inline por campo
   *   409 (CNPJ duplicado) → mensagem mapeada para o campo cnpj
   *   outros → mensagem genérica no rodapé do modal
   */
  private tratarErroModalEmpresa(err: HttpErrorResponse): void {
    console.error('Erro ao salvar empresa:', err);
    if (err.status === 400 && err.error?.errors) {
      this.errosValidacaoEmpresa.set(this.normalizarErros(err.error.errors));
      this.mostrarErroNaModal(this.erroModalEmpresa, 'Corrija os campos destacados.');
    } else if (err.status === 409) {
      const msg = err.error?.message ?? 'CNPJ já cadastrado no sistema.';
      if (/cnpj/i.test(msg)) {
        this.errosValidacaoEmpresa.set({ cnpj: msg });
        this.mostrarErroNaModal(this.erroModalEmpresa, 'Corrija os campos destacados.');
      } else {
        this.mostrarErroNaModal(this.erroModalEmpresa, msg);
      }
    } else {
      this.mostrarErroNaModal(this.erroModalEmpresa, this.extrairMensagemErro(err));
    }
    this.carregandoModalEmpresa.set(false);
  }

  /**
   * criarFormCadastro()
   *
   * Factory do FormGroup do modal de cadastro. Chamado na inicialização
   * da propriedade (antes do ngOnInit) — os validators são aplicados desde
   * a criação do form.
   *
   * idAtuacaoEspecifica começa disabled (observarCluster o habilita ao
   * selecionar um cluster). O Validators.required é aplicado mesmo assim —
   * quando o controle é habilitado, a validação já está ativa.
   */
  private criarFormCadastro(): FormGroup {
    return this.fb.group({
      // ── Dados pessoais ───────────────────────────────────────────────────
      nomeCompleto:      ['', Validators.required],
      cpf:               ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      emailPrincipal:    ['', [Validators.required, Validators.email]],
      telefonePrincipal: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      dataNascimento:    ['', [Validators.required, validarIdadeMinima16Anos]],

      // ── Dados administrativos ────────────────────────────────────────────
      dataIngresso:                  ['', [Validators.required, validarDataNaoFutura]],
      dataPagamentoPrimeiraAnuidade: [null], // opcional

      // ── Vínculos ─────────────────────────────────────────────────────────
      idEquipe:            [null, Validators.required],
      idCluster:           [null, Validators.required],
      idAtuacaoEspecifica: [null, Validators.required], // disable/enable via observarCluster()

      // Cargo sempre fixo como "Associado" no cadastro — habilitado só na edição.
      // Começa disabled: Angular exclui da validade do form, mas getRawValue()
      // ainda lê o valor para o DTO. Valor preenchido por aplicarCargoAssociado()
      // após o forkJoin carregar os cargos.
      idCargoLideranca:    [{ value: null, disabled: true }, Validators.required],
      dataInicioCargo:     [this.obterDataHoje(), [Validators.required, validarDataNaoFutura]],
      // Sempre true — o toggle foi removido do formulário (PRD: aniversário visível por padrão)
      exibirAniversario:   [true],

      // ── Endereço residencial ─────────────────────────────────────────────
      rua:         ['', Validators.required],
      numero:      ['', Validators.required],
      complemento: [null],
      bairro:      ['', Validators.required],
      cidade:      ['', Validators.required],
      estado:      ['', [Validators.required, Validators.maxLength(2)]],
      cep:         ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    });
  }

  /**
   * criarFormEditarDados()
   *
   * Factory do FormGroup do submodal de edição de dados pessoais (Tarefa 7.3).
   * Quatro campos editáveis: nomeCompleto, emailPrincipal, telefonePrincipal,
   * dataNascimento. CPF não é editável por regra de negócio.
   */
  private criarFormEditarDados(): FormGroup {
    return this.fb.group({
      nomeCompleto:      ['', [Validators.required, Validators.maxLength(100)]],
      emailPrincipal:    ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telefonePrincipal: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      dataNascimento:    ['', [Validators.required, validarIdadeMinima16Anos]],
    });
  }

  /**
   * normalizarErros(errors)
   *
   * O Spring Boot serializa erros de campos aninhados com o caminho completo:
   * ex. 'endereco.cep' → mensagem.
   * Este método remove o prefixo, deixando só o nome do campo ('cep'),
   * que é o que o template usa para acesso direto em errosValidacao().
   */
  private normalizarErros(errors: Record<string, string>): Record<string, string> {
    // Mapa de renomeação: chave do DTO Java → nome do FormControl Angular.
    // Necessário quando o campo do backend tem nome diferente do controle do formulário.
    const renomear: Record<string, string> = {
      idEquipeAtual: 'idEquipe',
    };

    const resultado: Record<string, string> = {};
    for (const [chave, mensagem] of Object.entries(errors)) {
      const chaveSimples = chave.includes('.') ? chave.split('.').pop()! : chave;
      const chaveFinal   = renomear[chaveSimples] ?? chaveSimples;
      resultado[chaveFinal] = mensagem;
    }
    return resultado;
  }

  /**
   * obterDataHoje()
   *
   * Retorna a data de hoje no formato ISO 8601 (YYYY-MM-DD).
   * Usado para pré-preencher campos de data com valor padrão.
   */
  private obterDataHoje(): string {
    const hoje = new Date();
    const ano  = hoje.getFullYear();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia  = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * mostrarErroNaModal(sinal, mensagem)
   *
   * Método genérico de erro em modal: define qualquer WritableSignal<string|null>
   * e agenda auto-dismiss após 3 segundos.
   * Usar este método em TODOS os modais — nunca chamar signal.set() diretamente
   * para exibir mensagens de erro (apenas para limpar, i.e. .set(null)).
   */
  private mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }

  /** Atalho para o modal de cadastro (mantém chamadas existentes funcionando). */
  private mostrarErroModal(mensagem: string): void {
    this.mostrarErroNaModal(this.erroModal, mensagem);
  }

  /**
   * extrairMensagemErro(err)
   *
   * Extrai mensagem legível do erro HTTP retornado pelo backend.
   * Segue CLAUDE.md SEÇÃO 12 (formato de erro do backend).
   */
  private extrairMensagemErro(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;

    if (err.error?.errors) {
      return Object.values(err.error.errors as Record<string, string>).join(' ');
    }

    if (err.status === 0) return 'Servidor indisponível. Verifique sua conexão.';

    const mensagens: Record<number, string> = {
      400: 'Erro de validação. Verifique os dados.',
      401: 'Sessão expirada. Faça login novamente.',
      403: 'Você não tem permissão para esta ação.',
      404: 'Recurso não encontrado.',
      409: 'Conflito: CPF ou e-mail já cadastrado no sistema.',
      422: 'Violação de regra de negócio.',
      500: 'Erro interno do servidor. Tente novamente.',
    };

    return mensagens[err.status] ?? 'Erro desconhecido. Tente novamente.';
  }

  /**
   * aplicarCargoAssociado()
   *
   * Localiza o cargo de nome "Associado" na lista já carregada e o define
   * como valor do controle idCargoLideranca (que fica disabled no cadastro).
   *
   * Chamado em dois momentos:
   *   1. Após o forkJoin em carregarDadosModal() — primeira abertura.
   *   2. Em resetarFormularioCadastro() — reabertura (cargos já em memória).
   *
   * Se o cargo não for encontrado (configuração incorreta no banco),
   * o campo fica nulo e o operador receberá erro 400 do backend — intencionalmente
   * não silenciamos: é uma falha de dados que precisa ser corrigida na origem.
   */
  private aplicarCargoAssociado(): void {
    const cargo = this.cargos().find(
      c => c.nomeCargo.trim().toLowerCase() === 'associado'
    );
    if (!cargo) return;
    this.formCadastro.get('idCargoLideranca')?.setValue(cargo.idCargoLideranca);
  }
}
