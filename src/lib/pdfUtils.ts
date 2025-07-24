import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface FaturamentoData {
  cliente_nome: string;
  total_exames: number;
  valor_total: number;
  periodo: string;
  exames: Array<{
    paciente: string;
    data_exame: string;
    modalidade: string;
    especialidade: string;
    nome_exame: string;
    quantidade: number;
    valor_bruto: number;
  }>;
}

export const generatePDF = async (data: FaturamentoData): Promise<Blob> => {
  console.log('🔍 Dados recebidos no generatePDF:', data);
  console.log('🔍 Exames array:', data.exames);
  console.log('🔍 Primeiro exame:', data.exames[0]);
  
  // Criar elemento HTML temporário para o relatório
  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.width = '210mm';
  reportElement.style.padding = '20px';
  reportElement.style.fontFamily = 'Arial, sans-serif';
  reportElement.style.backgroundColor = 'white';
  
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

  const createClienteInfo = () => {
    const clienteDiv = document.createElement('div');
    clienteDiv.style.marginBottom = '30px';
    clienteDiv.style.padding = '20px';
    clienteDiv.style.border = '1px solid #ddd';
    clienteDiv.style.borderRadius = '8px';
    
    const clienteTitle = document.createElement('h2');
    clienteTitle.style.color = '#374151';
    clienteTitle.style.marginBottom = '15px';
    clienteTitle.textContent = `Cliente: ${sanitizeHtml(data.cliente_nome)}`;
    
    const gridDiv = document.createElement('div');
    gridDiv.style.display = 'grid';
    gridDiv.style.gridTemplateColumns = '1fr 1fr';
    gridDiv.style.gap = '20px';
    
    const totalExamesDiv = document.createElement('div');
    const totalExamesP = document.createElement('p');
    totalExamesP.innerHTML = `<strong>Total de Exames:</strong> ${data.total_exames}`;
    totalExamesDiv.appendChild(totalExamesP);
    
    const valorTotalDiv = document.createElement('div');
    const valorTotalP = document.createElement('p');
    valorTotalP.innerHTML = `<strong>Valor Total:</strong> R$ ${data.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    valorTotalDiv.appendChild(valorTotalP);
    
    gridDiv.appendChild(totalExamesDiv);
    gridDiv.appendChild(valorTotalDiv);
    clienteDiv.appendChild(clienteTitle);
    clienteDiv.appendChild(gridDiv);
    
    return clienteDiv;
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
    
    const headers = ['Paciente', 'Data', 'Modalidade', 'Especialidade', 'Exame', 'Qtd', 'Valor'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.style.border = '1px solid #ddd';
      th.style.padding = '8px';
      th.style.textAlign = headerText === 'Qtd' ? 'center' : headerText === 'Valor' ? 'right' : 'left';
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
        sanitizeHtml(exame.paciente),
        new Date(exame.data_exame).toLocaleDateString('pt-BR'),
        sanitizeHtml(exame.modalidade),
        sanitizeHtml(exame.especialidade),
        sanitizeHtml(exame.nome_exame),
        exame.quantidade.toString(),
        `R$ ${exame.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ];
      
      cells.forEach((cellText, index) => {
        const td = document.createElement('td');
        td.style.border = '1px solid #ddd';
        td.style.padding = '6px';
        if (index === 5) td.style.textAlign = 'center'; // Qtd
        if (index === 6) td.style.textAlign = 'right';  // Valor
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
  reportElement.appendChild(createClienteInfo());
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
    
    // Criar PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
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