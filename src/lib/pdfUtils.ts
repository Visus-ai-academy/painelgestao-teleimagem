import jsPDF from 'jspdf';

export interface FaturamentoData {
  cliente_nome: string;
  total_exames: number;
  valor_total: number;
  periodo: string;
  valor_bruto: number;
  franquia: number;
  integracao: number;
  portal_laudos: number;
  impostos: number;
  valor_liquido: number;
  exames: Array<{
    unidade_origem: string;
    paciente: string;
    accession_number: string;
    nome_exame: string;
    laudado_por: string;
    prioridade: string;
    modalidade: string;
    especialidade: string;
    categoria: string;
    quantidade_laudos: number;
    valor_total: number;
    data_exame: string;
  }>;
}

export const generatePDF = async (data: FaturamentoData): Promise<Blob> => {
  console.log('🔍 Dados recebidos no generatePDF:', data);
  console.log('🔍 Exames array:', data.exames);
  console.log('🔍 Primeiro exame:', data.exames[0]);
  
  // Função para formatar valor com verificação de undefined/null
  const formatarValor = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null || isNaN(valor)) {
      return 'R$ 0,00';
    }
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // Calcular impostos detalhados
  const calcularImpostosDetalhados = (valorBruto: number) => {
    const irpj = valorBruto * 0.015; // 1.5%
    const pis = valorBruto * 0.0065; // 0.65%
    const cofins = valorBruto * 0.03; // 3%
    const csll = valorBruto * 0.01; // 1%
    
    return {
      irpj,
      pis,
      cofins,
      csll,
      total: irpj + pis + cofins + csll
    };
  };

  // Criar PDF em PAISAGEM com jsPDF
  const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape (paisagem)
  const pageWidth = pdf.internal.pageSize.getWidth(); // ~297mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // ~210mm
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);
  
  let currentY = margin;
  
  // Função para adicionar texto com quebra de linha automática
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    const fontSize = options.fontSize || 10;
    const maxWidth = options.maxWidth || contentWidth;
    const align = options.align || 'left';
    
    pdf.setFontSize(fontSize);
    if (options.bold) pdf.setFont('helvetica', 'bold');
    else pdf.setFont('helvetica', 'normal');
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    
    for (let i = 0; i < lines.length; i++) {
      let textX = x;
      if (align === 'center') {
        textX = x + (maxWidth / 2) - (pdf.getTextWidth(lines[i]) / 2);
      } else if (align === 'right') {
        textX = x + maxWidth - pdf.getTextWidth(lines[i]);
      }
      
      pdf.text(lines[i], textX, y + (i * (fontSize * 0.4)));
    }
    
    return y + (lines.length * (fontSize * 0.4));
  };
  
  // Função para adicionar nova página se necessário
  const checkNewPage = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }
  };
  
  // CABEÇALHO
  currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY + 15, {
    fontSize: 20,
    bold: true,
    align: 'center',
    maxWidth: contentWidth
  });
  
  currentY = addText(`Período: ${data.periodo}`, margin, currentY + 10, {
    fontSize: 12,
    align: 'center',
    maxWidth: contentWidth
  });
  
  currentY += 20;
  
  // INFORMAÇÕES DO CLIENTE
  checkNewPage(80);
  
  // Retângulo para informações do cliente
  pdf.setDrawColor(200, 200, 200);
  pdf.setFillColor(248, 249, 250);
  pdf.rect(margin, currentY, contentWidth, 60, 'FD');
  
  currentY = addText(`Cliente: ${data.cliente_nome}`, margin + 5, currentY + 12, {
    fontSize: 16,
    bold: true,
    align: 'center',
    maxWidth: contentWidth - 10
  });
  
  currentY += 15;
  
  // Informações básicas (lado esquerdo)
  const leftColumnX = margin + 10;
  const rightColumnX = margin + (contentWidth / 2) + 10;
  let leftY = currentY;
  
  leftY = addText(`Período: ${data.periodo}`, leftColumnX, leftY, { fontSize: 11 });
  leftY = addText(`Total de Exames: ${data.total_exames}`, leftColumnX, leftY + 6, { fontSize: 11 });
  leftY = addText(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, leftColumnX, leftY + 6, { fontSize: 11 });
  
  // Resumo financeiro (lado direito)
  const impostosDetalhados = calcularImpostosDetalhados(data.valor_bruto);
  
  const resumoData = [
    ['Valor Bruto', formatarValor(data.valor_bruto)],
    ['(-) Franquia', formatarValor(data.franquia)],
    ['(-) Integração', formatarValor(data.integracao)],
    ['(-) Portal Laudos', formatarValor(data.portal_laudos)],
    ['(-) IRPJ (1,5%)', formatarValor(impostosDetalhados.irpj)],
    ['(-) PIS (0,65%)', formatarValor(impostosDetalhados.pis)],
    ['(-) COFINS (3%)', formatarValor(impostosDetalhados.cofins)],
    ['(-) CSLL (1%)', formatarValor(impostosDetalhados.csll)],
    ['VALOR LÍQUIDO', formatarValor(data.valor_liquido)]
  ];
  
  let rightY = currentY;
  const colWidth = (contentWidth / 2) - 20;
  
  resumoData.forEach((row, index) => {
    const isTotal = index === resumoData.length - 1;
    
    if (isTotal) {
      pdf.setDrawColor(33, 150, 243);
      pdf.setFillColor(227, 242, 253);
      pdf.rect(rightColumnX, rightY - 2, colWidth, 8, 'FD');
    }
    
    rightY = addText(row[0], rightColumnX + 2, rightY, { 
      fontSize: isTotal ? 12 : 10, 
      bold: isTotal 
    });
    
    addText(row[1], rightColumnX + 2, rightY - (isTotal ? 4.8 : 4), { 
      fontSize: isTotal ? 12 : 10, 
      bold: isTotal,
      align: 'right',
      maxWidth: colWidth - 4
    });
    
    rightY += isTotal ? 10 : 6;
  });
  
  currentY = Math.max(leftY, rightY) + 10;
  
  // TABELA DE EXAMES
  checkNewPage(50);
  
  currentY = addText('Detalhamento dos Exames', margin, currentY + 10, {
    fontSize: 14,
    bold: true
  });
  
  currentY += 15;
  
  // Cabeçalho da tabela
  const headers = ['Unidade', 'Paciente', 'Accession', 'Exame', 'Médico', 'Prior.', 'Modal.', 'Espec.', 'Categ.', 'Qtd', 'Valor'];
  const colWidths = [20, 30, 18, 35, 25, 15, 15, 20, 15, 12, 20]; // Total: 225mm
  
  let tableX = margin + ((contentWidth - 225) / 2); // Centralizar tabela
  
  // Desenhar cabeçalho
  pdf.setFillColor(37, 99, 235);
  pdf.setTextColor(255, 255, 255);
  pdf.rect(tableX, currentY, 225, 8, 'F');
  
  let headerX = tableX;
  headers.forEach((header, index) => {
    addText(header, headerX + 1, currentY + 6, {
      fontSize: 8,
      bold: true,
      maxWidth: colWidths[index] - 2
    });
    headerX += colWidths[index];
  });
  
  currentY += 8;
  pdf.setTextColor(0, 0, 0);
  
  // Desenhar linhas da tabela
  data.exames.forEach((exame, index) => {
    checkNewPage(6);
    
    // Alternar cor de fundo
    if (index % 2 === 0) {
      pdf.setFillColor(248, 249, 250);
      pdf.rect(tableX, currentY, 225, 6, 'F');
    }
    
    const cells = [
      exame.unidade_origem.substring(0, 12),
      exame.paciente.substring(0, 18),
      exame.accession_number.substring(0, 12),
      exame.nome_exame.substring(0, 22),
      exame.laudado_por.substring(0, 15),
      exame.prioridade.substring(0, 8),
      exame.modalidade.substring(0, 8),
      exame.especialidade.substring(0, 12),
      exame.categoria.substring(0, 8),
      (exame.quantidade_laudos || 0).toString(),
      formatarValor(exame.valor_total)
    ];
    
    let cellX = tableX;
    cells.forEach((cell, cellIndex) => {
      const align = cellIndex === 9 ? 'center' : cellIndex === 10 ? 'right' : 'left';
      addText(cell, cellX + 1, currentY + 4, {
        fontSize: 7,
        maxWidth: colWidths[cellIndex] - 2,
        align: align
      });
      cellX += colWidths[cellIndex];
    });
    
    currentY += 6;
  });
  
  // Desenhar bordas da tabela
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.1);
  
  // Bordas externas
  pdf.rect(tableX, margin + 85, 225, currentY - (margin + 85));
  
  // Linhas verticais
  let lineX = tableX;
  colWidths.forEach(width => {
    lineX += width;
    if (lineX < tableX + 225) {
      pdf.line(lineX, margin + 85, lineX, currentY);
    }
  });
  
  // RODAPÉ
  currentY += 20;
  checkNewPage(20);
  
  currentY = addText(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, margin, currentY, {
    fontSize: 10,
    align: 'center',
    maxWidth: contentWidth
  });
  
  // Converter para Blob
  const pdfBlob = pdf.output('blob');
  console.log(`📄 PDF gerado - Tamanho: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
  
  return pdfBlob;
};

export const downloadPDF = async (data: FaturamentoData, filename: string) => {
  const blob = await generatePDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};