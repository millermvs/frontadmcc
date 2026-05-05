// ============================================================
// DESENVOLVIMENTO — URLs locais (localhost)
// ============================================================
// Quando roda "ng serve", o Angular usa ESTE arquivo.
// O angular.json já está configurado para trocar automaticamente
// via fileReplacements no build de produção.
// ============================================================

const baseUrl = 'http://localhost:8080/api/v1';

export const environment = {
  production: false,

  api: {
    // ========== AUTH ==========
    auth: {
      login: `${baseUrl}/auth/login`,
      register: `${baseUrl}/auth/register`,
    },

    // ========== ASSOCIADOS ==========
    associados: {
      listar: `${baseUrl}/associados`,
      cadastrar: `${baseUrl}/associados`,
      buscarPorId: (id: number) => `${baseUrl}/associados/${id}`,
      editar: (id: number) => `${baseUrl}/associados/${id}`,
      confirmarCadastro: (id: number) => `${baseUrl}/associados/${id}/confirmar-cadastro`,
      renovarAnuidade: (id: number) => `${baseUrl}/associados/${id}/renovar-anuidade`,
      alterarStatus: (id: number) => `${baseUrl}/associados/${id}/alterar-status`,
      historicoStatus: (id: number) => `${baseUrl}/associados/${id}/historico-status`,
      editarEquipe: (id: number) => `${baseUrl}/associados/${id}/equipe`,
      perfil: (cpf: string) => `${baseUrl}/associados/${cpf}/perfil`,
      editarCampo: (cpf: string, campo: string) => `${baseUrl}/associados/${cpf}/campo/${campo}`,
      togglePermissao: (cpf: string, campo: string) => `${baseUrl}/associados/${cpf}/permissao/${campo}`,
    },

    // ========== ANUIDADES ==========
    anuidades: {
      cadastrar: `${baseUrl}/associados-anuidades`,
      buscarPorId: (id: number) => `${baseUrl}/associados-anuidades/${id}`,
      editar: (id: number) => `${baseUrl}/associados-anuidades/${id}`,
      porAssociado: (id: number) => `${baseUrl}/associados-anuidades/associado/${id}`,
    },

    // ========== RENOVAÇÕES ==========
    renovacoes: {
      porAssociado: (id: number) => `${baseUrl}/associados-renovacoes/associado/${id}`,
    },

    // ========== CARGOS LIDERANÇA ==========
    cargosLideranca: {
      listar: `${baseUrl}/cargos-lideranca`,
      cadastrar: `${baseUrl}/cargos-lideranca`,
      buscarPorId: (id: number) => `${baseUrl}/cargos-lideranca/${id}`,
      editar: (id: number) => `${baseUrl}/cargos-lideranca/${id}`,
    },

    // ========== CARGO ASSOCIADO ==========
    associadosCargos: {
      cadastrar: `${baseUrl}/associados-cargos`,
      buscarPorId: (id: number) => `${baseUrl}/associados-cargos/${id}`,
      editar: (id: number) => `${baseUrl}/associados-cargos/${id}`,
      porAssociado: (id: number) => `${baseUrl}/associados-cargos/associado/${id}`,
      porCargo: (id: number) => `${baseUrl}/associados-cargos/cargo/${id}`,
    },

    // ========== ENDEREÇOS RESIDENCIAIS ==========
    enderecosResidenciais: {
      cadastrar: (idAssociado: number) => `${baseUrl}/enderecos-residenciais/associado/${idAssociado}`,
      editar: (id: number) => `${baseUrl}/enderecos-residenciais/${id}`,
      porAssociado: (id: number) => `${baseUrl}/enderecos-residenciais/associado/${id}`,
    },

    // ========== GRUPAMENTOS ==========
    grupamentos: {
      listar: `${baseUrl}/grupamentos`,
      cadastrar: `${baseUrl}/grupamentos`,
      buscarPorId: (id: number) => `${baseUrl}/grupamentos/${id}`,
      editar: (id: number) => `${baseUrl}/grupamentos/${id}`,
    },

    // ========== ASSOCIADO-GRUPAMENTO ==========
    associadosGrupamentos: {
      cadastrar: `${baseUrl}/associados-grupamentos`,
      buscarPorId: (id: number) => `${baseUrl}/associados-grupamentos/${id}`,
      editar: (id: number) => `${baseUrl}/associados-grupamentos/${id}`,
      porAssociado: (id: number) => `${baseUrl}/associados-grupamentos/associado/${id}`,
      porGrupamento: (id: number) => `${baseUrl}/associados-grupamentos/grupamento/${id}`,
    },

    // ========== VISIBILIDADE ==========
    visibilidade: {
      cadastrar: `${baseUrl}/visibilidades`,
      buscarPorId: (id: number) => `${baseUrl}/visibilidades/${id}`,
      editar: (id: number) => `${baseUrl}/visibilidades/${id}`,
      porAssociado: (id: number) => `${baseUrl}/visibilidades/associado/${id}`,
    },

    // ========== EQUIPES ==========
    equipes: {
      listar: `${baseUrl}/equipes`,
      cadastrar: `${baseUrl}/equipes`,
      buscarPorId: (id: number) => `${baseUrl}/equipes/${id}`,
      editar: (id: number) => `${baseUrl}/equipes/${id}`,
    },

    // ========== EQUIPE — CARGOS ATIVOS ==========
    equipesCargosAtivos: {
      cadastrar: `${baseUrl}/equipes-cargos-ativos`,
      buscarPorId: (id: number) => `${baseUrl}/equipes-cargos-ativos/${id}`,
      editar: (id: number) => `${baseUrl}/equipes-cargos-ativos/${id}`,
      porEquipe: (id: number) => `${baseUrl}/equipes-cargos-ativos/equipe/${id}`,
      ativosPorEquipe: (id: number) => `${baseUrl}/equipes-cargos-ativos/equipe/${id}/ativos`,
    },

    // ========== EQUIPE — DESIGNAÇÃO LIDERANÇA ==========
    equipesDesignacao: {
      cadastrar: `${baseUrl}/equipes-designacao-lideranca`,
      buscarPorId: (id: number) => `${baseUrl}/equipes-designacao-lideranca/${id}`,
      editar: (id: number) => `${baseUrl}/equipes-designacao-lideranca/${id}`,
      porEquipe: (id: number) => `${baseUrl}/equipes-designacao-lideranca/equipe/${id}`,
    },

    // ========== EQUIPE — DIRETOR DE EQUIPE ==========
    equipesDiretorEquipe: {
      cadastrar: `${baseUrl}/equipes-diretor-equipe`,
      buscarPorId: (id: number) => `${baseUrl}/equipes-diretor-equipe/${id}`,
      editar: (id: number) => `${baseUrl}/equipes-diretor-equipe/${id}`,
      porEquipe: (id: number) => `${baseUrl}/equipes-diretor-equipe/equipe/${id}`,
    },

    // ========== EQUIPE — DIRETOR DE TERRITÓRIO ==========
    equipesDiretorTerritorio: {
      cadastrar: `${baseUrl}/equipes-diretor-territorio`,
      buscarPorId: (id: number) => `${baseUrl}/equipes-diretor-territorio/${id}`,
      editar: (id: number) => `${baseUrl}/equipes-diretor-territorio/${id}`,
      porEquipe: (id: number) => `${baseUrl}/equipes-diretor-territorio/equipe/${id}`,
    },

    // ========== DIRETORES DE EQUIPE (DE) ==========
    diretoresEquipe: {
      cadastrar: `${baseUrl}/diretores-equipe`,
      buscarPorId: (id: number) => `${baseUrl}/diretores-equipe/${id}`,
      editar: (id: number) => `${baseUrl}/diretores-equipe/${id}`,
      porEquipe: (id: number) => `${baseUrl}/diretores-equipe/equipe/${id}`,
    },

    // ========== DIRETORES DE TERRITÓRIO (DT) ==========
    diretoresTerritorio: {
      cadastrar: `${baseUrl}/diretores-territorio`,
      buscarPorId: (id: number) => `${baseUrl}/diretores-territorio/${id}`,
      editar: (id: number) => `${baseUrl}/diretores-territorio/${id}`,
      porEquipe: (id: number) => `${baseUrl}/diretores-territorio/equipe/${id}`,
    },

    // ========== EQUIPE — LOCAL PRESENCIAL ==========
    // Endpoint separado: só é chamado quando modeloReuniao ≠ ONLINE
    locaisPresenciais: {
      cadastrar: `${baseUrl}/locais-presenciais`,
      buscarPorId: (id: number) => `${baseUrl}/locais-presenciais/${id}`,
      editar: (id: number) => `${baseUrl}/locais-presenciais/${id}`,
      porEquipe: (id: number) => `${baseUrl}/locais-presenciais/equipe/${id}`,
    },

    // ========== PONTUAÇÃO FAIXAS ==========
    pontuacaoFaixas: {
      listar: `${baseUrl}/pontuacao-faixas`,
      cadastrar: `${baseUrl}/pontuacao-faixas`,
      buscarPorId: (id: number) => `${baseUrl}/pontuacao-faixas/${id}`,
      editar: (id: number) => `${baseUrl}/pontuacao-faixas/${id}`,
      ativas: `${baseUrl}/pontuacao-faixas/ativas`,
    },

    // ========== CLUSTERS ==========
    clusters: {
      listar: `${baseUrl}/clusters`,
      cadastrar: `${baseUrl}/clusters`,
      buscarPorId: (id: number) => `${baseUrl}/clusters/${id}`,
      editar: (id: number) => `${baseUrl}/clusters/${id}`,
    },

    // ========== ATUAÇÕES ESPECÍFICAS ==========
    atuacoesEspecificas: {
      listar: `${baseUrl}/atuacoes-especificas`,
      cadastrar: `${baseUrl}/atuacoes-especificas`,
      buscarPorId: (id: number) => `${baseUrl}/atuacoes-especificas/${id}`,
      editar: (id: number) => `${baseUrl}/atuacoes-especificas/${id}`,
      porCluster: (id: number) => `${baseUrl}/atuacoes-especificas/cluster/${id}`,
    },

    // ========== EMPRESAS ==========
    empresas: {
      cadastrar: `${baseUrl}/empresas`,
      buscarPorId: (id: number) => `${baseUrl}/empresas/${id}`,
      editar: (id: number) => `${baseUrl}/empresas/${id}`,
      porAssociado: (id: number) => `${baseUrl}/empresas/associado/${id}`,
    },

    // ========== ENDEREÇOS COMERCIAIS ==========
    enderecosComerciais: {
      cadastrar: `${baseUrl}/enderecos-comerciais`,
      buscarPorId: (id: number) => `${baseUrl}/enderecos-comerciais/${id}`,
      editar: (id: number) => `${baseUrl}/enderecos-comerciais/${id}`,
      porEmpresa: (id: number) => `${baseUrl}/enderecos-comerciais/empresa/${id}`,
    },

    // ========== PERFIL ASSOCIADO ==========
    perfisAssociado: {
      cadastrar: `${baseUrl}/perfis`,
      buscarPorId: (id: number) => `${baseUrl}/perfis/${id}`,
      editar: (id: number) => `${baseUrl}/perfis/${id}`,
      porAssociado: (id: number) => `${baseUrl}/perfis/associado/${id}`,
    },

    // ========== CONEXÕES ==========
    conexoes: {
      registrar: `${baseUrl}/conexoes`,
      geradas: `${baseUrl}/conexoes/geradas`,
      recebidas: `${baseUrl}/conexoes/recebidas`,
      resumoGeradas: `${baseUrl}/conexoes/geradas/resumo`,
      resumoRecebidas: `${baseUrl}/conexoes/recebidas/resumo`,
      atualizarStatus: (id: number) => `${baseUrl}/conexoes/${id}/status`,
      excluir: (id: number) => `${baseUrl}/conexoes/${id}`,
    },

    // ========== CICLOS SEMANAIS ==========
    ciclosSemanais: {
      porEquipe: (idEquipe: number) => `${baseUrl}/ciclos-semanais/equipe/${idEquipe}`,
    },

    // ========== PRODUTOS (Stripe) ==========
    produtos: {
      listar: `${baseUrl}/../produtos`,
      cadastrar: `${baseUrl}/../produtos`,
      buscarPorId: (id: number) => `${baseUrl}/../produtos/${id}`,
      editar: (id: number) => `${baseUrl}/../produtos/${id}`,
      checkout: `${baseUrl}/../produtos/checkout`,
    },
  },
};
