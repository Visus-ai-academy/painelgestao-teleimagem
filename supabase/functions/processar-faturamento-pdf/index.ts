import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { read, utils } from "https://esm.sh/xlsx@0.18.5";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExameData {
  data_exame: string;
  nome_paciente: string;
  nome_cliente: string;
  cnpj_cliente: string;
  nome_medico_laudador: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  quantidade_laudos: number;
  valor: number;
  franquia?: number;
  ajuste?: number;
}

interface ClienteResumo {
  nome: string;
  cnpj: string;
  exames: ExameData[];
  total_laudos: number;
  valor_bruto: number;
  franquia: number;
  ajuste: number;
  sub_total: number;
  irrf: number;
  csll: number;
  pis: number;
  cofins: number;
  valor_pagar: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { file_path, periodo } = await req.json();
    
    console.log('Processando arquivo:', file_path, 'para período:', periodo);

    // Download do arquivo Excel
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documentos-clientes')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    // Ler arquivo Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = utils.sheet_to_json(worksheet);

    console.log('Dados do Excel:', rawData.length, 'linhas');

    // Processar dados e agrupar por cliente
    const clientesMap = new Map<string, ClienteResumo>();

    rawData.forEach((row: any) => {
      const exame: ExameData = {
        data_exame: row['Data do Exame'] || row['data_exame'] || '',
        nome_paciente: row['Nome do Paciente'] || row['nome_paciente'] || '',
        nome_cliente: row['Nome do Cliente'] || row['nome_cliente'] || '',
        cnpj_cliente: row['CNPJ Cliente'] || row['cnpj_cliente'] || '',
        nome_medico_laudador: row['Nome do Médico Laudador'] || row['nome_medico_laudador'] || '',
        modalidade: row['Modalidade'] || row['modalidade'] || '',
        especialidade: row['Especialidade'] || row['especialidade'] || '',
        categoria: row['Categoria'] || row['categoria'] || '',
        prioridade: row['Prioridade'] || row['prioridade'] || '',
        quantidade_laudos: Number(row['Quantidade de Laudos'] || row['quantidade_laudos'] || 0),
        valor: Number(row['Valor'] || row['valor'] || 0),
        franquia: Number(row['Franquia'] || row['franquia'] || 0),
        ajuste: Number(row['Ajuste'] || row['ajuste'] || 0)
      };

      const chaveCliente = exame.nome_cliente;
      
      if (!clientesMap.has(chaveCliente)) {
        clientesMap.set(chaveCliente, {
          nome: exame.nome_cliente,
          cnpj: exame.cnpj_cliente,
          exames: [],
          total_laudos: 0,
          valor_bruto: 0,
          franquia: 0,
          ajuste: 0,
          sub_total: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          valor_pagar: 0
        });
      }

      const cliente = clientesMap.get(chaveCliente)!;
      cliente.exames.push(exame);
      
      // Calcular totais
      cliente.total_laudos += exame.quantidade_laudos;
      cliente.valor_bruto += exame.valor;
      cliente.franquia += exame.franquia || 0;
      cliente.ajuste += exame.ajuste || 0;
    });

    // Calcular impostos para cada cliente
    clientesMap.forEach((cliente) => {
      cliente.sub_total = cliente.valor_bruto + cliente.franquia + cliente.ajuste;
      cliente.irrf = cliente.sub_total * 0.015; // 1.5%
      cliente.csll = cliente.sub_total * 0.01; // 1%
      cliente.pis = cliente.sub_total * 0.0065; // 0.65%
      cliente.cofins = cliente.sub_total * 0.03; // 3%
      cliente.valor_pagar = cliente.sub_total - cliente.irrf - cliente.csll - cliente.pis - cliente.cofins;
    });

    console.log('Clientes processados:', clientesMap.size);

    // Gerar PDFs para cada cliente
    const pdfsGerados = [];
    
    for (const [chaveCliente, cliente] of clientesMap) {
      try {
        const pdf = gerarPDFCliente(cliente, periodo);
        const pdfBytes = pdf.output('arraybuffer');
        
        // Upload do PDF para storage
        const nomeArquivo = `${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documentos-clientes')
          .upload(`faturamento/${periodo}/${nomeArquivo}`, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error('Erro ao fazer upload do PDF:', uploadError);
          continue;
        }

        // Obter URL do arquivo
        const { data: urlData } = supabase.storage
          .from('documentos-clientes')
          .getPublicUrl(`faturamento/${periodo}/${nomeArquivo}`);

        pdfsGerados.push({
          cliente: cliente.nome,
          arquivo: nomeArquivo,
          url: urlData.publicUrl,
          resumo: {
            total_laudos: cliente.total_laudos,
            valor_pagar: cliente.valor_pagar
          }
        });

      } catch (error) {
        console.error(`Erro ao gerar PDF para ${cliente.nome}:`, error);
      }
    }

    console.log('PDFs gerados:', pdfsGerados.length);

    return new Response(JSON.stringify({
      success: true,
      message: `${pdfsGerados.length} relatórios gerados com sucesso`,
      clientes_processados: clientesMap.size,
      pdfs_gerados: pdfsGerados
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Erro no processamento:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function gerarPDFCliente(cliente: ClienteResumo, periodo: string): jsPDF {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Configurar senha (4 primeiros dígitos do CNPJ)
  const senha = cliente.cnpj.replace(/\D/g, '').substring(0, 4);
  pdf.setUserPermissions(['print'], senha);

  const pageWidth = 297; // A4 landscape width
  const pageHeight = 210; // A4 landscape height
  let yPosition = 20;

  // Parte superior - Logomarca e título
  pdf.setFontSize(20);
  pdf.setFont(undefined, 'bold');
  pdf.text('RELATÓRIO DE VOLUMETRIA - FATURAMENTO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Quadro 1 - Dados do cliente
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'normal');
  const quadro1Y = yPosition;
  pdf.rect(10, quadro1Y, pageWidth - 20, 25);
  
  pdf.text(`Cliente: ${cliente.nome}`, 15, quadro1Y + 8);
  pdf.text(`CNPJ: ${cliente.cnpj}`, 15, quadro1Y + 16);
  pdf.text(`Período: ${formatarPeriodo(periodo)}`, 15, quadro1Y + 24);
  yPosition = quadro1Y + 35;

  // Quadro 2 - Resumo Financeiro
  const quadro2Y = yPosition;
  pdf.rect(10, quadro2Y, pageWidth - 20, 60);
  
  pdf.setFont(undefined, 'bold');
  pdf.text('RESUMO FINANCEIRO', 15, quadro2Y + 8);
  pdf.setFont(undefined, 'normal');
  
  const resumoLines = [
    `Total de Laudos: ${cliente.total_laudos.toLocaleString()}`,
    `Valor Bruto: R$ ${cliente.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `Franquia: R$ ${cliente.franquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `Ajuste: R$ ${cliente.ajuste.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `Sub Total: R$ ${cliente.sub_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `IRRF (1,5%): R$ ${cliente.irrf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `CSLL (1%): R$ ${cliente.csll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `PIS (0,65%): R$ ${cliente.pis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `COFINS (3%): R$ ${cliente.cofins.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ];
  
  resumoLines.forEach((line, index) => {
    pdf.text(line, 15, quadro2Y + 16 + (index * 5));
  });
  
  pdf.setFont(undefined, 'bold');
  pdf.text(`VALOR A PAGAR: R$ ${cliente.valor_pagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 15, quadro2Y + 56);
  yPosition = quadro2Y + 70;

  // Quadro 3 - Detalhamento dos Exames
  pdf.setFont(undefined, 'bold');
  pdf.text('DETALHAMENTO DOS EXAMES', 15, yPosition);
  yPosition += 10;

  // Cabeçalho da tabela
  const colunas = [
    'Data', 'Paciente', 'Médico', 'Modalidade', 'Especialidade', 
    'Categoria', 'Prioridade', 'Qtd', 'Valor', 'Franquia', 'Ajuste'
  ];
  
  const colWidths = [25, 40, 40, 25, 25, 25, 20, 15, 20, 20, 20];
  let xPos = 15;
  
  pdf.setFontSize(8);
  colunas.forEach((col, index) => {
    pdf.text(col, xPos, yPosition);
    xPos += colWidths[index];
  });
  
  yPosition += 5;
  pdf.line(10, yPosition, pageWidth - 10, yPosition);
  yPosition += 5;

  // Dados dos exames
  pdf.setFont(undefined, 'normal');
  cliente.exames.forEach((exame) => {
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }

    xPos = 15;
    const dados = [
      formatarData(exame.data_exame),
      truncateText(exame.nome_paciente, 35),
      truncateText(exame.nome_medico_laudador, 35),
      truncateText(exame.modalidade, 20),
      truncateText(exame.especialidade, 20),
      truncateText(exame.categoria, 20),
      truncateText(exame.prioridade, 15),
      exame.quantidade_laudos.toString(),
      `R$ ${exame.valor.toFixed(2)}`,
      `R$ ${(exame.franquia || 0).toFixed(2)}`,
      `R$ ${(exame.ajuste || 0).toFixed(2)}`
    ];
    
    dados.forEach((dado, index) => {
      pdf.text(dado, xPos, yPosition);
      xPos += colWidths[index];
    });
    
    yPosition += 4;
  });

  // Adicionar última página com informações de geração
  pdf.addPage();
  const agora = new Date();
  const infoGeracao = `Relatório gerado automaticamente em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`;
  
  pdf.setFontSize(10);
  pdf.text(infoGeracao, pageWidth / 2, pageHeight / 2, { align: 'center' });

  return pdf;
}

function formatarPeriodo(periodo: string): string {
  const [ano, mes] = periodo.split('-');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${meses[parseInt(mes) - 1]} de ${ano}`;
}

function formatarData(data: string): string {
  if (!data) return '';
  try {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return data;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}