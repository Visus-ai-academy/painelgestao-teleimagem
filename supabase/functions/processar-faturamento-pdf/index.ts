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
  console.log('=== INICIANDO PROCESSAR-FATURAMENTO-PDF ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Método da requisição:', req.method);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variáveis de ambiente não configuradas');
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Cliente Supabase criado com sucesso');

    const body = await req.json();
    console.log('Body recebido:', JSON.stringify(body, null, 2));
    
    const { file_path, periodo, enviar_emails = true } = body;
    
    if (!file_path || !periodo) {
      console.error('Parâmetros faltando:', { file_path, periodo });
      throw new Error('Parâmetros file_path e periodo são obrigatórios');
    }
    
    console.log('Processando arquivo:', file_path, 'para período:', periodo);

    // STEP 1: Download do arquivo
    console.log('STEP 1: Baixando arquivo do storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    if (!fileData) {
      console.error('Arquivo não encontrado');
      throw new Error('Arquivo não encontrado no storage');
    }

    console.log('Arquivo baixado com sucesso, size:', fileData.size);

    // STEP 2: Processar Excel
    console.log('STEP 2: Processando arquivo Excel...');
    const arrayBuffer = await fileData.arrayBuffer();
    console.log('ArrayBuffer criado, size:', arrayBuffer.byteLength);
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    console.log('Workbook criado, sheets:', workbook.SheetNames);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Dados extraídos do Excel: ${data.length} linhas`);

    if (data.length === 0) {
      throw new Error('Arquivo Excel está vazio ou não contém dados válidos');
    }

    // STEP 3: Agrupar por cliente
    console.log('STEP 3: Agrupando dados por cliente...');
    const dadosProcessados = data as ExameData[];
    const clientesResumo = new Map<string, ClienteResumo>();

    dadosProcessados.forEach((exame, index) => {
      console.log(`Processando linha ${index + 1}:`, Object.keys(exame));
      
      const clienteNome = exame.cliente || exame.Cliente || '';
      if (!clienteNome) {
        console.log(`Linha ${index + 1}: Cliente não encontrado`);
        return;
      }

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
      
      const valor = Number(exame.valor_pagar || exame['Valor a Pagar'] || 0);
      cliente.valorTotal += valor;
      cliente.exames.push(exame);
      
      if (index < 5) {
        console.log(`Cliente: ${clienteNome}, Valor: ${valor}`);
      }
    });

    console.log(`${clientesResumo.size} clientes únicos encontrados`);

    // STEP 4: Gerar relatórios
    console.log('STEP 4: Gerando relatórios...');
    const relatoriosGerados = [];
    let emailsEnviados = 0;

    for (const [nomeCliente, resumo] of clientesResumo) {
      try {
        console.log(`Processando cliente: ${nomeCliente}`);
        
        // Gerar relatório em texto
        const relatorioTexto = gerarRelatorioTexto(resumo, periodo);
        
        // Upload do relatório
        const nomeArquivo = `faturamento_${nomeCliente.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.txt`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(`relatorios/${nomeArquivo}`, relatorioTexto, {
            contentType: 'text/plain',
            upsert: true
          });

        if (uploadError) {
          console.error(`Erro no upload para ${nomeCliente}:`, uploadError);
          relatoriosGerados.push({
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

        relatoriosGerados.push({
          cliente: nomeCliente,
          url: publicUrl,
          resumo: {
            total_laudos: resumo.totalLaudos,
            valor_pagar: resumo.valorTotal
          },
          email_enviado: false
        });

        console.log(`Relatório gerado para ${nomeCliente}: ${publicUrl}`);

      } catch (error) {
        console.error(`Erro ao processar cliente ${nomeCliente}:`, error);
        relatoriosGerados.push({
          cliente: nomeCliente,
          erro: `Erro no processamento: ${error.message}`,
          email_enviado: false
        });
      }
    }

    console.log(`PROCESSAMENTO CONCLUÍDO: ${relatoriosGerados.length} relatórios processados`);

    const response = {
      success: true,
      message: 'Processamento de faturamento concluído',
      pdfs_gerados: relatoriosGerados,
      emails_enviados: emailsEnviados,
      periodo,
      total_clientes: clientesResumo.size
    };

    console.log('Resposta final:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('=== ERRO NO PROCESSAMENTO ===');
    console.error('Erro:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    const errorResponse = {
      success: false,
      error: error.message,
      details: error.stack || 'Stack trace não disponível'
    };

    console.log('Resposta de erro:', JSON.stringify(errorResponse, null, 2));
    
    return new Response(JSON.stringify(errorResponse), {
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
  try {
    const [ano, mes] = periodo.split('-');
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[parseInt(mes) - 1]} de ${ano}`;
  } catch {
    return periodo;
  }
}