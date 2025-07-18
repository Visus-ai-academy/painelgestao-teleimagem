import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { read, utils } from "https://esm.sh/xlsx@0.18.5";

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
  email?: string;
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando processamento de faturamento PDF...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { file_path, periodo, enviar_emails = true } = body;
    
    if (!file_path || !periodo) {
      throw new Error('Parâmetros file_path e periodo são obrigatórios');
    }
    
    console.log('Processando arquivo:', file_path, 'para período:', periodo);

    return new Response(JSON.stringify({
      success: true,
      message: 'Teste de conectividade realizado com sucesso',
      parametros: { file_path, periodo, enviar_emails }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });


  } catch (error: any) {
    console.error('Erro no processamento:', error);
    
    // Log detalhado do erro para debug
    console.error('Stack trace:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack || 'Stack trace não disponível'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function gerarPDFCliente(cliente: ClienteResumo, periodo: string): jsPDF {
  try {
    console.log(`Gerando PDF para cliente: ${cliente.nome}`);
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

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

    console.log(`PDF gerado com sucesso para cliente: ${cliente.nome}`);
    return pdf;
  } catch (error: any) {
    console.error(`Erro ao gerar PDF para cliente ${cliente.nome}:`, error);
    throw new Error(`Falha na geração do PDF: ${error.message}`);
  }
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