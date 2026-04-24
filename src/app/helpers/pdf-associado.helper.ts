import jsPDF from 'jspdf';
import { AssociadoResponseDto, LABELS_STATUS_ASSOCIADO } from '../models/associado.model';

// ============================================================================
// CORES — espelham os tokens do styles.css
// Definidas como tuplas RGB para o jsPDF (que não aceita hex diretamente).
// ============================================================================
const VERDE      = [47,  133, 90]  as [number, number, number];
const VERDE_BG   = [240, 253, 244] as [number, number, number];
const VERDE_DARK = [39,  103, 73]  as [number, number, number];
const TEXTO      = [15,  23,  42]  as [number, number, number];
const CINZA      = [100, 116, 139] as [number, number, number];
const BORDA      = [226, 232, 240] as [number, number, number];
const BRANCO     = [255, 255, 255] as [number, number, number];

// Cores de status — [fundo, texto]
const STATUS_CORES: Record<string, [[number,number,number],[number,number,number]]> = {
  ATIVO:    [[220, 252, 231], [22,  101, 52]],
  PREATIVO: [[255, 247, 237], [146, 64,  14]],
};
const STATUS_COR_PADRAO: [[number,number,number],[number,number,number]] =
  [[254, 226, 226], [153, 27, 27]];

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ============================================================================
// GERADOR PRINCIPAL
//
// Função pura: recebe os dados do associado e dispara o download do PDF.
// Nenhum efeito colateral além do download do arquivo.
//
// Layout A4 (210 x 297mm):
//   Margens: 20mm laterais, 20mm topo/base
//   Largura útil: 170mm
//   Seções: cabeçalho colorido → nome/status → dados pessoais →
//           dados administrativos → vínculos → rodapé
// ============================================================================
export function gerarPdfAssociado(assoc: AssociadoResponseDto): void {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M    = 20;   // margem lateral
  const W    = 170;  // largura do conteúdo (210 - 2*20)
  const colW = W / 2;
  let y      = 0;

  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  // ==========================================================================
  // CABEÇALHO — faixa verde com nome do sistema, título e data
  // ==========================================================================
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 42, 'F');

  // Subtítulo do sistema
  doc.setTextColor(...BRANCO);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('C+C · Gestão de Associados', M, 12);

  // Título principal
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Ficha do Associado', M, 25);

  // Data de geração
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${hoje}`, M, 35);

  // Avatar circular com iniciais — canto direito do cabeçalho
  const avX = 210 - M - 14;
  const avY = 21;
  doc.setFillColor(...BRANCO);
  doc.circle(avX, avY, 13, 'F');
  doc.setFillColor(...VERDE_DARK);
  doc.circle(avX, avY, 13, 'D'); // borda sutil
  doc.setTextColor(...VERDE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(iniciais(assoc.nomeCompleto), avX, avY + 1.5, {
    align: 'center',
    baseline: 'middle',
  });

  y = 52;

  // ==========================================================================
  // NOME + STATUS + ID
  // ==========================================================================
  doc.setTextColor(...TEXTO);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(assoc.nomeCompleto, M, y);

  y += 7;

  // Badge de status
  const statusLabel           = LABELS_STATUS_ASSOCIADO[assoc.statusAssociado];
  const [bgCor, textoCor]     = STATUS_CORES[assoc.statusAssociado] ?? STATUS_COR_PADRAO;
  const badgeW                = doc.getTextWidth(statusLabel) + 8;
  doc.setFillColor(...bgCor);
  doc.roundedRect(M, y, badgeW, 7, 2, 2, 'F');
  doc.setTextColor(...textoCor);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, M + 4, y + 5);

  // ID ao lado do badge
  doc.setTextColor(...CINZA);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID #${assoc.idAssociado}`, M + badgeW + 5, y + 5);

  y += 14;

  // Linha separadora
  doc.setDrawColor(...BORDA);
  doc.line(M, y, M + W, y);
  y += 8;

  // ==========================================================================
  // HELPER — cabeçalho de seção
  // Faixa verde claro + barra lateral verde + label em uppercase.
  // ==========================================================================
  const sectionHeader = (titulo: string): void => {
    if (y + 20 > 277) { doc.addPage(); y = M; }
    doc.setFillColor(...VERDE_BG);
    doc.rect(M, y, W, 8, 'F');
    doc.setFillColor(...VERDE);
    doc.rect(M, y, 3, 8, 'F');
    doc.setTextColor(...VERDE);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo.toUpperCase(), M + 7, y + 5.5);
    y += 13;
  };

  // ==========================================================================
  // HELPER — linha de 2 colunas (label + valor)
  // Chama com l2/v2 vazios para linha de coluna única.
  // ==========================================================================
  const row2 = (l1: string, v1: string, l2 = '', v2 = ''): void => {
    if (y + 15 > 277) { doc.addPage(); y = M; }

    // Coluna esquerda
    doc.setTextColor(...CINZA);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(l1.toUpperCase(), M, y);

    doc.setTextColor(...TEXTO);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Texto longo pode ultrapassar a coluna — clip em colW - 4mm
    const v1Texto = v1 || '—';
    const v1Split = doc.splitTextToSize(v1Texto, colW - 4);
    doc.text(v1Split[0], M, y + 5.5); // só a primeira linha (campo simples)

    // Coluna direita (opcional)
    if (l2) {
      doc.setTextColor(...CINZA);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(l2.toUpperCase(), M + colW, y);

      doc.setTextColor(...TEXTO);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const v2Texto = v2 || '—';
      const v2Split = doc.splitTextToSize(v2Texto, colW - 4);
      doc.text(v2Split[0], M + colW, y + 5.5);
    }

    // Linha divisória entre linhas
    doc.setDrawColor(...BORDA);
    doc.line(M, y + 11, M + W, y + 11);
    y += 15;
  };

  // ==========================================================================
  // SEÇÃO 1 — DADOS PESSOAIS
  // ==========================================================================
  sectionHeader('Dados Pessoais');
  row2('Nome Completo',      assoc.nomeCompleto,       'CPF',       assoc.cpf);
  row2('Data de Nascimento', formatarData(assoc.dataNascimento), 'Telefone / WhatsApp', assoc.telefonePrincipal);
  row2('E-mail Principal',   assoc.emailPrincipal);

  y += 3;

  // ==========================================================================
  // SEÇÃO 2 — DADOS ADMINISTRATIVOS
  // ==========================================================================
  sectionHeader('Dados Administrativos');
  row2('Data de Ingresso',  formatarData(assoc.dataIngresso),
       'Data de Vencimento', formatarData(assoc.dataVencimento));
  row2('1ª Anuidade',
    assoc.dataPagamentoPrimeiraAnuidade
      ? formatarData(assoc.dataPagamentoPrimeiraAnuidade)
      : 'Aguardando');

  if (assoc.dataInicioPausa) {
    row2('Início da Pausa',     formatarData(assoc.dataInicioPausa),
         'Previsão de Retorno', formatarData(assoc.dataPrevisaoRetorno));
  }

  if (assoc.motivoStatusInativo) {
    row2('Motivo da Inativação', assoc.motivoStatusInativo);
  }

  y += 3;

  // ==========================================================================
  // SEÇÃO 3 — VÍNCULOS
  // ==========================================================================
  sectionHeader('Vínculos');
  row2('Equipe Atual',     assoc.nomeEquipe,     'Equipe de Origem', assoc.nomeEquipeOrigem);
  row2('Cluster',          assoc.nomeCluster,    'Atuação Específica', assoc.nomeAtuacaoEspecifica);
  row2('Padrinho',         assoc.nomePadrinho ?? 'Sem padrinho',
       'Tipo de Origem',   assoc.tipoOrigemEquipe === 'ORIGINAL' ? 'Original' : 'Colaborativa');

  // ==========================================================================
  // RODAPÉ — em todas as páginas
  // ==========================================================================
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDA);
    doc.line(M, 287, M + W, 287);
    doc.setTextColor(...CINZA);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `C+C Gestão Associados · Documento confidencial · Gerado em ${hoje}`,
      M,
      293,
    );
    if (totalPaginas > 1) {
      doc.text(`Página ${i} de ${totalPaginas}`, M + W, 293, { align: 'right' });
    }
  }

  // ==========================================================================
  // DOWNLOAD
  // Nome do arquivo: ficha-nome-do-associado.pdf (sem acentos, minúsculas)
  // ==========================================================================
  const nomeArq = `ficha-${assoc.nomeCompleto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  }.pdf`;

  doc.save(nomeArq);
}
