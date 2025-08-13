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
  reportElement.style.width = '297mm'; // A4 paisagem
  reportElement.style.padding = '15px';
  reportElement.style.fontFamily = 'Arial, sans-serif';
  reportElement.style.backgroundColor = 'white';
  reportElement.style.fontSize = '10px';
  
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
    resumoDiv.style.marginBottom = '20px';
    resumoDiv.style.padding = '15px';
    resumoDiv.style.border = '1px solid #ddd';
    resumoDiv.style.borderRadius = '8px';
    
    const clienteTitle = document.createElement('h2');
    clienteTitle.style.color = '#374151';
    clienteTitle.style.marginBottom = '15px';
    clienteTitle.style.fontSize = '16px';
    clienteTitle.textContent = `Cliente: ${sanitizeHtml(data.cliente_nome)}`;
    
    // Tabela resumo financeiro
    const resumoTable = document.createElement('table');
    resumoTable.style.width = '100%';
    resumoTable.style.borderCollapse = 'collapse';
    resumoTable.style.marginTop = '10px';
    resumoTable.style.fontSize = '12px';
    
    const resumoData = [
      ['Valor Bruto', `R$ ${data.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Franquia', `R$ ${data.franquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Integração', `R$ ${data.integracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Portal Laudos', `R$ ${data.portal_laudos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Impostos', `R$ ${data.impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Valor Líquido', `R$ ${data.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]
    ];
    
    resumoData.forEach((row, index) => {
      const tr = document.createElement('tr');
      if (index === resumoData.length - 1) {
        tr.style.fontWeight = 'bold';
        tr.style.backgroundColor = '#f3f4f6';
      }
      
      const td1 = document.createElement('td');
      td1.style.border = '1px solid #ddd';
      td1.style.padding = '8px';
      td1.textContent = row[0];
      
      const td2 = document.createElement('td');
      td2.style.border = '1px solid #ddd';
      td2.style.padding = '8px';
      td2.style.textAlign = 'right';
      td2.style.width = '150px';
      td2.textContent = row[1];
      
      tr.appendChild(td1);
      tr.appendChild(td2);
      resumoTable.appendChild(tr);
    });
    
    resumoDiv.appendChild(clienteTitle);
    resumoDiv.appendChild(resumoTable);
    
    return resumoDiv;
  };

  const createExamesTable = () => {
    const containerDiv = document.createElement('div');
    
    const title = document.createElement('h3');
    title.style.color = '#374151';
    title.style.marginBottom = '15px';
    title.textContent = 'Detalhamento dos Exames';
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    
    // Criar cabeçalho
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f3f4f6';
    
    const headers = ['Unidade Origem', 'Paciente', 'Accession Number', 'Nome Exame', 'Laudado Por', 'Prioridade', 'Modalidade', 'Especialidade', 'Categoria', 'Qtd Laudos', 'Valor Total'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.style.border = '1px solid #ddd';
      th.style.padding = '6px';
      th.style.fontSize = '9px';
      th.style.textAlign = headerText === 'Qtd Laudos' ? 'center' : headerText === 'Valor Total' ? 'right' : 'left';
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Criar corpo da tabela
    const tbody = document.createElement('tbody');
    data.exames.forEach(exame => {
      const row = document.createElement('tr');
      
      const cells = [
        sanitizeHtml(exame.unidade_origem),
        sanitizeHtml(exame.paciente),
        sanitizeHtml(exame.accession_number),
        sanitizeHtml(exame.nome_exame),
        sanitizeHtml(exame.laudado_por),
        sanitizeHtml(exame.prioridade),
        sanitizeHtml(exame.modalidade),
        sanitizeHtml(exame.especialidade),
        sanitizeHtml(exame.categoria),
        exame.quantidade_laudos.toString(),
        `R$ ${exame.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ];
      
      cells.forEach((cellText, index) => {
        const td = document.createElement('td');
        td.style.border = '1px solid #ddd';
        td.style.padding = '4px';
        td.style.fontSize = '8px';
        if (index === 9) td.style.textAlign = 'center'; // Qtd Laudos
        if (index === 10) td.style.textAlign = 'right';  // Valor Total
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
    // Converter HTML para canvas
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Criar PDF em PAISAGEM
    const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape (paisagem)
    const imgData = canvas.toDataURL('image/png');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;
    
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    
    // Converter para Blob
    return pdf.output('blob');
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