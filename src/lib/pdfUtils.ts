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
  // Criar elemento HTML temporário para o relatório
  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.width = '210mm';
  reportElement.style.padding = '20px';
  reportElement.style.fontFamily = 'Arial, sans-serif';
  reportElement.style.backgroundColor = 'white';
  
  reportElement.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1e40af; margin-bottom: 10px;">Relatório de Faturamento</h1>
      <p style="color: #666; font-size: 14px;">Período: ${data.periodo}</p>
    </div>
    
    <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #374151; margin-bottom: 15px;">Cliente: ${data.cliente_nome}</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <p><strong>Total de Exames:</strong> ${data.total_exames}</p>
        </div>
        <div>
          <p><strong>Valor Total:</strong> R$ ${data.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    </div>
    
    <div>
      <h3 style="color: #374151; margin-bottom: 15px;">Detalhamento dos Exames</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Paciente</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Data</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Modalidade</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Especialidade</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Exame</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qtd</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${data.exames.map(exame => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 6px;">${exame.paciente}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${new Date(exame.data_exame).toLocaleDateString('pt-BR')}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${exame.modalidade}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${exame.especialidade}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${exame.nome_exame}</td>
              <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${exame.quantidade}</td>
              <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">R$ ${exame.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
      <p>Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  `;
  
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