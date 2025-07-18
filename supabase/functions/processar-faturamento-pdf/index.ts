import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExameData {
  cliente?: string;
  Cliente?: string;
  valor_pagar?: number;
  'Valor a Pagar'?: number;
  data_exame?: string;
  nome_paciente?: string;
  nome_medico_laudador?: string;
  modalidade?: string;
  especialidade?: string;
  categoria?: string;
  prioridade?: string;
  quantidade_laudos?: number;
  valor?: number;
  [key: string]: any;
}

interface ClienteResumo {
  nome: string;
  email: string;
  totalLaudos: number;
  valorTotal: number;
  exames: ExameData[];
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

    // Baixar arquivo do storage
    console.log('Tentativa 1 de download do arquivo...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('Arquivo não encontrado no storage');
    }

    // Converter para ArrayBuffer e processar Excel
    console.log('Lendo arquivo Excel...');
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Dados do Excel: ${data.length} linhas`);

    if (data.length === 0) {
      throw new Error('Arquivo Excel está vazio ou não contém dados válidos');
    }

    // Processar dados e agrupar por cliente
    const dadosProcessados = data as ExameData[];
    const clientesResumo = new Map<string, ClienteResumo>();

    dadosProcessados.forEach((exame) => {
      const clienteNome = exame.cliente || exame.Cliente || '';
      if (!clienteNome) return;

      if (!clientesResumo.has(clienteNome)) {
        clientesResumo.set(clienteNome, {
          nome: clienteNome,
          email: '',
          totalLaudos: 0,
          valorTotal: 0,
          exames: []
        });
      }

      const cliente = clientesResumo.get(clienteNome)!;
      cliente.totalLaudos++;
      cliente.valorTotal += Number(exame.valor_pagar || exame['Valor a Pagar'] || 0);
      cliente.exames.push(exame);
    });

    console.log(`${clientesResumo.size} clientes únicos encontrados`);

    // Gerar PDFs para cada cliente
    const pdfsGerados = [];
    let emailsEnviados = 0;

    for (const [nomeCliente, resumo] of clientesResumo) {
      try {
        console.log(`Processando cliente: ${nomeCliente}`);
        
        // Por enquanto, vamos criar um relatório em texto simples
        const relatorioTexto = gerarRelatorioTexto(resumo, periodo);
        
        // Upload do relatório como arquivo de texto
        const nomeArquivo = `faturamento_${nomeCliente.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.txt`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(`relatorios/${nomeArquivo}`, relatorioTexto, {
            contentType: 'text/plain',
            upsert: true
          });

        if (uploadError) {
          console.error(`Erro no upload do relatório para ${nomeCliente}:`, uploadError);
          pdfsGerados.push({
            cliente: nomeCliente,
            erro: `Erro no upload: ${uploadError.message}`,
            email_enviado: false
          });
          continue;
        }

        // URL pública do relatório
        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(`relatorios/${nomeArquivo}`);

        pdfsGerados.push({
          cliente: nomeCliente,
          url: publicUrl,
          resumo: {
            total_laudos: resumo.totalLaudos,
            valor_pagar: resumo.valorTotal
          },
          email_enviado: false
        });

        console.log(`Relatório gerado com sucesso para ${nomeCliente}: ${publicUrl}`);

      } catch (error) {
        console.error(`Erro ao processar cliente ${nomeCliente}:`, error);
        pdfsGerados.push({
          cliente: nomeCliente,
          erro: `Erro no processamento: ${error.message}`,
          email_enviado: false
        });
      }
    }

    console.log(`Processamento concluído: ${pdfsGerados.length} relatórios processados`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento de faturamento concluído',
      pdfs_gerados: pdfsGerados,
      emails_enviados: emailsEnviados,
      periodo,
      total_clientes: clientesResumo.size
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

function gerarRelatorioTexto(cliente: ClienteResumo, periodo: string): string {
  try {
    console.log(`Gerando relatório em texto para cliente: ${cliente.nome}`);
    
    const relatorio = `
RELATÓRIO DE FATURAMENTO
========================

Cliente: ${cliente.nome}
Período: ${formatarPeriodo(periodo)}
Data de Geração: ${new Date().toLocaleString('pt-BR')}

RESUMO FINANCEIRO
-----------------
Total de Laudos: ${cliente.totalLaudos}
Valor Total: R$ ${cliente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

DETALHAMENTO DOS EXAMES
-----------------------
${cliente.exames.slice(0, 20).map((exame, index) => {
  const valor = Number(exame.valor_pagar || exame['Valor a Pagar'] || 0);
  return `${index + 1}. Cliente: ${exame.cliente || exame.Cliente || ''} - Valor: R$ ${valor.toFixed(2)}`;
}).join('\n')}

${cliente.exames.length > 20 ? `\n... e mais ${cliente.exames.length - 20} exames` : ''}

---
Relatório gerado automaticamente pelo sistema
    `;

    console.log(`Relatório em texto gerado com sucesso para cliente: ${cliente.nome}`);
    return relatorio;
  } catch (error: any) {
    console.error(`Erro ao gerar relatório para cliente ${cliente.nome}:`, error);
    throw new Error(`Falha na geração do relatório: ${error.message}`);
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