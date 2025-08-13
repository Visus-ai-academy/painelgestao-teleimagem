import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  
  // Criar elemento HTML temporário para o relatório (PAISAGEM)
  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.width = '1600px'; // Largura maior para melhor distribuição
  reportElement.style.minHeight = '1000px'; // Altura proporcional
  reportElement.style.padding = '30px';
  reportElement.style.fontFamily = 'Arial, sans-serif';
  reportElement.style.backgroundColor = 'white';
  reportElement.style.fontSize = '13px';
  reportElement.style.boxSizing = 'border-box';
  reportElement.style.lineHeight = '1.4';
  
  // Função para sanitizar strings e prevenir XSS
  const sanitizeHtml = (str: string): string => {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => {
      const entityMap: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return entityMap[match];
    });
  };

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
    const total = irpj + pis + cofins + csll;
    
    return {
      irpj,
      pis,
      cofins,
      csll,
      total
    };
  };

  // Criar elementos DOM de forma segura
  const createHeader = () => {
    const headerDiv = document.createElement('div');
    headerDiv.style.textAlign = 'center';
    headerDiv.style.marginBottom = '30px';
    
    const title = document.createElement('h1');
    title.style.color = '#1e40af';
    title.style.marginBottom = '10px';
    title.textContent = 'Relatório de Faturamento';
    
    const periodo = document.createElement('p');
    periodo.style.color = '#666';
    periodo.style.fontSize = '14px';
    periodo.textContent = `Período: ${sanitizeHtml(data.periodo)}`;
    
    headerDiv.appendChild(title);
    headerDiv.appendChild(periodo);
    return headerDiv;
  };

  const createResumoFinanceiro = () => {
    const resumoDiv = document.createElement('div');
    resumoDiv.style.marginBottom = '30px';
    resumoDiv.style.padding = '20px';
    resumoDiv.style.border = '2px solid #ddd';
    resumoDiv.style.borderRadius = '8px';
    resumoDiv.style.backgroundColor = '#f8f9fa';
    
    const clienteTitle = document.createElement('h2');
    clienteTitle.style.color = '#374151';
    clienteTitle.style.marginBottom = '20px';
    clienteTitle.style.fontSize = '18px';
    clienteTitle.style.textAlign = 'center';
    clienteTitle.textContent = `Cliente: ${sanitizeHtml(data.cliente_nome)}`;
    
    // Container flexível para resumo em duas colunas
    const resumoContainer = document.createElement('div');
    resumoContainer.style.display = 'flex';
    resumoContainer.style.gap = '40px';
    resumoContainer.style.justifyContent = 'space-between';
    
    // Coluna esquerda - Informações básicas
    const colunaEsquerda = document.createElement('div');
    colunaEsquerda.style.flex = '1';
    
    const infoBasica = document.createElement('div');
    infoBasica.style.fontSize = '14px';
    infoBasica.innerHTML = `
      <p style="margin: 10px 0;"><strong>Período:</strong> ${sanitizeHtml(data.periodo)}</p>
      <p style="margin: 10px 0;"><strong>Total de Exames:</strong> ${data.total_exames}</p>
      <p style="margin: 10px 0;"><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
    `;
    
    colunaEsquerda.appendChild(infoBasica);
    
    // Coluna direita - Resumo financeiro
    const colunaDireita = document.createElement('div');
    colunaDireita.style.flex = '1';
    
    const resumoTable = document.createElement('table');
    resumoTable.style.width = '100%';
    resumoTable.style.borderCollapse = 'collapse';
    resumoTable.style.fontSize = '14px';
    
    // Calcular impostos detalhados
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
    
    resumoData.forEach((row, index) => {
      const tr = document.createElement('tr');
      if (index === resumoData.length - 1) {
        tr.style.fontWeight = 'bold';
        tr.style.backgroundColor = '#e3f2fd';
        tr.style.fontSize = '16px';
      }
      
      const td1 = document.createElement('td');
      td1.style.border = '1px solid #ddd';
      td1.style.padding = '10px';
      td1.textContent = row[0];
      
      const td2 = document.createElement('td');
      td2.style.border = '1px solid #ddd';
      td2.style.padding = '10px';
      td2.style.textAlign = 'right';
      td2.style.width = '120px';
      td2.textContent = row[1];
      
      tr.appendChild(td1);
      tr.appendChild(td2);
      resumoTable.appendChild(tr);
    });
    
    colunaDireita.appendChild(resumoTable);
    
    resumoContainer.appendChild(colunaEsquerda);
    resumoContainer.appendChild(colunaDireita);
    
    resumoDiv.appendChild(clienteTitle);
    resumoDiv.appendChild(resumoContainer);
    
    return resumoDiv;
  };

  const createExamesTable = () => {
    const containerDiv = document.createElement('div');
    containerDiv.style.marginTop = '20px';
    
    const title = document.createElement('h3');
    title.style.color = '#374151';
    title.style.marginBottom = '15px';
    title.style.fontSize = '16px';
    title.textContent = 'Detalhamento dos Exames';
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '11px';
    
    // Criar cabeçalho
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#2563eb';
    headerRow.style.color = 'white';
    
    const headers = ['Unidade Origem', 'Paciente', 'Accession', 'Exame', 'Médico', 'Prioridade', 'Modalidade', 'Especialidade', 'Categoria', 'Qtd', 'Valor'];
    const headerWidths = ['10%', '15%', '8%', '15%', '12%', '8%', '8%', '10%', '8%', '4%', '8%'];
    
    headers.forEach((headerText, index) => {
      const th = document.createElement('th');
      th.style.border = '1px solid #1e40af';
      th.style.padding = '8px 4px';
      th.style.fontSize = '10px';
      th.style.fontWeight = 'bold';
      th.style.width = headerWidths[index];
      th.style.textAlign = headerText === 'Qtd' ? 'center' : headerText === 'Valor' ? 'right' : 'left';
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Criar corpo da tabela
    const tbody = document.createElement('tbody');
    data.exames.forEach((exame, index) => {
      const row = document.createElement('tr');
      row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      
      const cells = [
        sanitizeHtml(exame.unidade_origem),
        sanitizeHtml(exame.paciente.substring(0, 20) + (exame.paciente.length > 20 ? '...' : '')), // Limitar tamanho
        sanitizeHtml(exame.accession_number),
        sanitizeHtml(exame.nome_exame.substring(0, 25) + (exame.nome_exame.length > 25 ? '...' : '')), // Limitar tamanho
        sanitizeHtml(exame.laudado_por.substring(0, 15) + (exame.laudado_por.length > 15 ? '...' : '')), // Limitar tamanho
        sanitizeHtml(exame.prioridade),
        sanitizeHtml(exame.modalidade),
        sanitizeHtml(exame.especialidade.substring(0, 12) + (exame.especialidade.length > 12 ? '...' : '')), // Limitar tamanho
        sanitizeHtml(exame.categoria),
        (exame.quantidade_laudos || 0).toString(),
        formatarValor(exame.valor_total)
      ];
      
      cells.forEach((cellText, cellIndex) => {
        const td = document.createElement('td');
        td.style.border = '1px solid #ddd';
        td.style.padding = '6px 4px';
        td.style.fontSize = '9px';
        td.style.width = headerWidths[cellIndex];
        if (cellIndex === 9) td.style.textAlign = 'center'; // Qtd
        if (cellIndex === 10) td.style.textAlign = 'right';  // Valor
        td.textContent = cellText;
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    containerDiv.appendChild(title);
    containerDiv.appendChild(table);
    
    return containerDiv;
  };

  const createFooter = () => {
    const footerDiv = document.createElement('div');
    footerDiv.style.marginTop = '30px';
    footerDiv.style.textAlign = 'center';
    footerDiv.style.color = '#666';
    footerDiv.style.fontSize = '12px';
    
    const footerP = document.createElement('p');
    footerP.textContent = `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`;
    footerDiv.appendChild(footerP);
    
    return footerDiv;
  };

  // Montar elemento do relatório de forma segura
  reportElement.appendChild(createHeader());
  reportElement.appendChild(createResumoFinanceiro());
  reportElement.appendChild(createExamesTable());
  reportElement.appendChild(createFooter());
  
  document.body.appendChild(reportElement);
  
  try {
    // Converter HTML para canvas com configurações otimizadas para paisagem
    const canvas = await html2canvas(reportElement, {
      scale: 1.5, // Escala adequada para qualidade
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      removeContainer: true,
      logging: false,
      width: 1600, // Largura fixa do container
      height: Math.max(1000, reportElement.offsetHeight) // Altura mínima ou do conteúdo
    });
    
    // Criar PDF em PAISAGEM com dimensões adequadas
    const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape (paisagem)
    
    // Usar JPEG com boa qualidade
    const imgData = canvas.toDataURL('image/jpeg', 0.8); // 80% de qualidade
    
    const pdfWidth = pdf.internal.pageSize.getWidth(); // ~297mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // ~210mm
    
    // Calcular proporções para preencher a página
    const imgAspectRatio = canvas.width / canvas.height;
    const pdfAspectRatio = pdfWidth / pdfHeight;
    
    let finalWidth, finalHeight, offsetX, offsetY;
    
    // Maximizar preenchimento da página mantendo proporção
    finalWidth = pdfWidth - 10; // Margem mínima de 5mm de cada lado
    finalHeight = pdfHeight - 10; // Margem mínima de 5mm em cima e embaixo
    offsetX = 5;
    offsetY = 5;
    
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, finalWidth, finalHeight);
    
    // Converter para Blob com compressão
    const pdfBlob = pdf.output('blob');
    console.log(`📄 PDF gerado - Tamanho: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Verificar se o arquivo é muito grande (limite Supabase: ~50MB)
    if (pdfBlob.size > 45 * 1024 * 1024) { // 45MB para margem de segurança
      throw new Error(`PDF muito grande (${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB). Limite: 45MB`);
    }
    
    return pdfBlob;
  } finally {
    // Remover elemento temporário
    document.body.removeChild(reportElement);
  }
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