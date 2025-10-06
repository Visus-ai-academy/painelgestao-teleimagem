import jsPDF from 'jspdf';

export interface FaturamentoData {
  cliente_nome: string;
  cliente_cnpj?: string;
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
    data_exame: string;
    paciente: string;
    medico: string;
    exame: string;
    modalidade: string;
    especialidade: string;
    categoria: string;
    prioridade: string;
    accession_number: string;
    origem: string;
    quantidade: number;
    valor_total: number;
  }>;
}

export const generatePDF = async (data: FaturamentoData): Promise<Blob> => {
  console.log('🔍 Dados recebidos no generatePDF:', data);
  console.log('🔍 Total de exames:', data.exames?.length || 0);
  
  // Função para formatar valor
  const formatarValor = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null || isNaN(valor)) {
      return 'R$ 0,00';
    }
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calcular impostos detalhados
  const calcularImpostosDetalhados = (valorBruto: number) => {
    const pis = valorBruto * 0.0065; // 0.65%
    const cofins = valorBruto * 0.03; // 3%
    const csll = valorBruto * 0.01; // 1%
    const irrf = valorBruto * 0.015; // 1.5%
    
    return { pis, cofins, csll, irrf, total: pis + cofins + csll + irrf };
  };

  // Criar PDF em RETRATO (portrait)
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  let currentY = margin;
  let pageNumber = 1;
  const totalPages = Math.ceil(data.exames.length / 25) + 1; // Estimar páginas
  
  // Função auxiliar para adicionar texto
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    pdf.setFontSize(options.fontSize || 10);
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    
    if (options.align === 'center') {
      const textWidth = pdf.getTextWidth(text);
      x = x + (options.maxWidth || contentWidth) / 2 - textWidth / 2;
    } else if (options.align === 'right') {
      const textWidth = pdf.getTextWidth(text);
      x = x + (options.maxWidth || contentWidth) - textWidth;
    }
    
    pdf.text(text, x, y);
    return y + (options.fontSize || 10) * 0.35;
  };
  
  // Função para adicionar rodapé
  const addFooter = () => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 
      pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };
  
  // Função para nova página
  const addNewPage = () => {
    pdf.addPage();
    pageNumber++;
    currentY = margin;
  };
  
  // ============= PÁGINA 1 - QUADRO 1 (RESUMO) =============
  
  // Logo/Cabeçalho
  currentY = addText('TELEiMAGEM', margin, currentY + 15, {
    fontSize: 18,
    bold: true,
    align: 'center',
    maxWidth: contentWidth
  });
  
  currentY = addText('EXCELÊNCIA EM TELERRADIOLOGIA', margin, currentY + 5, {
    fontSize: 10,
    align: 'center',
    maxWidth: contentWidth
  });
  
  currentY += 10;
  
  // Título
  currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY + 5, {
    fontSize: 14,
    bold: true,
    align: 'center',
    maxWidth: contentWidth
  });
  
  currentY += 15;
  
  // Informações do Cliente
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  currentY = addText(`Cliente: ${data.cliente_nome}`, margin, currentY, { fontSize: 11, bold: false });
  currentY = addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, currentY + 6, { fontSize: 11 });
  
  pdf.setFontSize(11);
  currentY = addText(`CNPJ: ${data.cliente_cnpj || 'N/A'}`, pageWidth - margin, currentY - 6, { 
    fontSize: 11, 
    align: 'right',
    maxWidth: 80
  });
  currentY = addText(`Período: ${data.periodo}`, pageWidth - margin, currentY + 6, { 
    fontSize: 11, 
    align: 'right',
    maxWidth: 80
  });
  
  currentY += 10;
  
  // QUADRO 1 - RESUMO
  currentY = addText('QUADRO 1 - RESUMO', margin, currentY + 5, {
    fontSize: 12,
    bold: true
  });
  
  currentY += 10;
  
  // Tabela de resumo
  const impostos = calcularImpostosDetalhados(data.valor_bruto);
  
  const resumoItems = [
    ['Total de Laudos:', data.total_exames.toString()],
    ['Valor Bruto:', formatarValor(data.valor_bruto)],
    ['Franquia:', formatarValor(data.franquia)],
    ['Portal de Laudos:', formatarValor(data.portal_laudos)],
    ['Integração:', formatarValor(data.integracao)],
    ['PIS (0.65%):', formatarValor(impostos.pis)],
    ['COFINS (3%):', formatarValor(impostos.cofins)],
    ['CSLL (1%):', formatarValor(impostos.csll)],
    ['IRRF (1.5%):', formatarValor(impostos.irrf)]
  ];
  
  pdf.setDrawColor(200);
  pdf.setLineWidth(0.1);
  
  resumoItems.forEach((item, index) => {
    const itemY = currentY + (index * 7);
    
    // Linha zebrada
    if (index % 2 === 0) {
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, itemY - 4, contentWidth, 7, 'F');
    }
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(item[0], margin + 2, itemY);
    pdf.text(item[1], pageWidth - margin - 2, itemY, { align: 'right' });
    
    // Linha horizontal
    pdf.line(margin, itemY + 2, pageWidth - margin, itemY + 2);
  });
  
  currentY += (resumoItems.length * 7) + 10;
  
  // VALOR A PAGAR - Destaque
  pdf.setFillColor(230, 230, 230);
  pdf.rect(margin, currentY, contentWidth, 10, 'F');
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VALOR A PAGAR:', margin + 2, currentY + 7);
  pdf.text(formatarValor(data.valor_liquido), pageWidth - margin - 2, currentY + 7, { align: 'right' });
  
  currentY += 15;
  
  // Rodapé da página 1
  addFooter();
  
  // ============= PÁGINA 2+ - QUADRO 2 (DETALHAMENTO) =============
  
  if (data.exames && data.exames.length > 0) {
    addNewPage();
    
    // Título do quadro 2
    currentY = addText('QUADRO 2 - DETALHAMENTO', margin, currentY + 10, {
      fontSize: 12,
      bold: true
    });
    
    currentY += 10;
    
    // Configuração da tabela
    const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
    const colWidths = [18, 25, 25, 30, 12, 18, 12, 15, 18, 18, 8, 20]; // Total: 219mm
    
    // Cabeçalho da tabela
    pdf.setFillColor(220, 220, 220);
    pdf.setDrawColor(100);
    pdf.setLineWidth(0.1);
    pdf.rect(margin, currentY, contentWidth, 7, 'FD');
    
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    
    let headerX = margin;
    headers.forEach((header, i) => {
      const cellWidth = colWidths[i];
      pdf.text(header, headerX + 1, currentY + 5);
      headerX += cellWidth;
    });
    
    currentY += 7;
    
    // Linhas de dados
    data.exames.forEach((exame, index) => {
      // Nova página se necessário (deixar espaço para rodapé)
      if (currentY > pageHeight - 25) {
        addFooter();
        addNewPage();
        currentY = margin + 10;
        
        // Repetir cabeçalho
        pdf.setFillColor(220, 220, 220);
        pdf.rect(margin, currentY, contentWidth, 7, 'FD');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        
        let hX = margin;
        headers.forEach((h, i) => {
          pdf.text(h, hX + 1, currentY + 5);
          hX += colWidths[i];
        });
        currentY += 7;
      }
      
      // Zebrar linhas
      if (index % 2 === 1) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, currentY, contentWidth, 6, 'F');
      }
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      
      // Formatar data
      const dataFormatada = exame.data_exame ? 
        new Date(exame.data_exame + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      
      // Truncar textos longos
      const cells = [
        dataFormatada,
        (exame.paciente || '').substring(0, 15),
        (exame.medico || '').substring(0, 15),
        (exame.exame || '').substring(0, 20),
        (exame.modalidade || '').substring(0, 6),
        (exame.especialidade || '').substring(0, 12),
        (exame.categoria || '').substring(0, 6),
        (exame.prioridade || '').substring(0, 10),
        (exame.accession_number || '').substring(0, 12),
        (exame.origem || '').substring(0, 12),
        (exame.quantidade || 1).toString(),
        formatarValor(exame.valor_total)
      ];
      
      let cellX = margin;
      cells.forEach((cell, cellIndex) => {
        const cellWidth = colWidths[cellIndex];
        const align = cellIndex === 10 ? 'center' : cellIndex === 11 ? 'right' : 'left';
        
        if (align === 'right') {
          pdf.text(cell, cellX + cellWidth - 2, currentY + 4.5, { align: 'right' });
        } else if (align === 'center') {
          pdf.text(cell, cellX + cellWidth / 2, currentY + 4.5, { align: 'center' });
        } else {
          pdf.text(cell, cellX + 1, currentY + 4.5);
        }
        
        cellX += cellWidth;
      });
      
      // Linha horizontal
      pdf.setDrawColor(200);
      pdf.line(margin, currentY + 6, pageWidth - margin, currentY + 6);
      
      currentY += 6;
    });
  }
  
  // Rodapé da última página
  addFooter();
  
  // Converter para Blob
  const pdfBlob = pdf.output('blob');
  console.log(`📄 PDF gerado - Tamanho: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
  
  return pdfBlob;
};

export const downloadPDF = async (data: FaturamentoData, filename: string) => {
  const blob = await generatePDF(data);
  const url = URL.createObjectURL(blob);
  
  // Abrir PDF em nova aba em vez de forçar download
  window.open(url, '_blank');
  
  // Opcional: também criar link de download caso usuário prefira
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  
  // Limpar URL após um tempo para evitar vazamento de memória
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};