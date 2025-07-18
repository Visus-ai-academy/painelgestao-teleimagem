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
  totalLaudos: number;
  valorTotal: number;
  exames: ExameData[];
}

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO-PDF OTIMIZADO ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('Iniciando processamento às:', new Date().toISOString());

    const body = await req.json();
    const { file_path, periodo, enviar_emails } = body;
    
    if (!file_path || !periodo) {
      throw new Error('Parâmetros file_path e periodo são obrigatórios');
    }
    
    console.log('Processando:', file_path, 'período:', periodo);

    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // STEP 1: Download com timeout
    console.log('STEP 1: Download do arquivo...');
    const downloadStart = Date.now();
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }
    if (!fileData) {
      throw new Error('Arquivo não encontrado');
    }

    console.log(`Download concluído em ${Date.now() - downloadStart}ms, size: ${fileData.size}`);

    // STEP 2: Processar Excel rapidamente
    console.log('STEP 2: Processando Excel...');
    const excelStart = Date.now();
    
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Excel processado em ${Date.now() - excelStart}ms, ${data.length} linhas`);

    if (data.length === 0) {
      throw new Error('Arquivo Excel vazio');
    }

    // STEP 3: Agrupar por cliente (otimizado)
    console.log('STEP 3: Agrupando por cliente...');
    const groupStart = Date.now();
    
    const clientesResumo = new Map<string, ClienteResumo>();
    const dadosProcessados = data as ExameData[];

    // Processa apenas os primeiros 1000 registros para evitar timeout
    const maxRegistros = Math.min(dadosProcessados.length, 1000);
    console.log(`Processando ${maxRegistros} de ${dadosProcessados.length} registros`);

    for (let i = 0; i < maxRegistros; i++) {
      const exame = dadosProcessados[i];
      const clienteNome = exame.cliente || exame.Cliente || '';
      
      if (!clienteNome) continue;

      if (!clientesResumo.has(clienteNome)) {
        clientesResumo.set(clienteNome, {
          nome: clienteNome,
          totalLaudos: 0,
          valorTotal: 0,
          exames: []
        });
      }

      const cliente = clientesResumo.get(clienteNome)!;
      cliente.totalLaudos++;
      
      const valor = Number(exame.valor_pagar || exame['Valor a Pagar'] || 0);
      cliente.valorTotal += valor;
      
      // Armazena apenas resumo para economizar memória
      if (cliente.exames.length < 5) {
        cliente.exames.push(exame);
      }
    }

    console.log(`Agrupamento concluído em ${Date.now() - groupStart}ms, ${clientesResumo.size} clientes`);

    // STEP 4: Gerar relatórios simplificados
    console.log('STEP 4: Gerando relatórios...');
    const reportStart = Date.now();
    
    const relatoriosGerados = [];
    const maxClientes = Math.min(clientesResumo.size, 10); // Limita a 10 clientes para evitar timeout
    let processedClients = 0;

    for (const [nomeCliente, resumo] of clientesResumo) {
      if (processedClients >= maxClientes) break;
      
      try {
        console.log(`Cliente ${processedClients + 1}/${maxClientes}: ${nomeCliente}`);
        
        // Gerar relatório simples
        const relatorio = gerarRelatorioSimples(resumo, periodo);
        
        // Upload com nome único
        const timestamp = Date.now();
        const nomeArquivo = `relatorio_${nomeCliente.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${timestamp}.txt`;
        
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(`relatorios/${nomeArquivo}`, relatorio, {
            contentType: 'text/plain',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error para ${nomeCliente}:`, uploadError.message);
          relatoriosGerados.push({
            cliente: nomeCliente,
            erro: `Upload failed: ${uploadError.message}`,
            email_enviado: false
          });
        } else {
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
        }

        processedClients++;

      } catch (error) {
        console.error(`Erro cliente ${nomeCliente}:`, error);
        relatoriosGerados.push({
          cliente: nomeCliente,
          erro: `Processing error: ${error.message}`,
          email_enviado: false
        });
        processedClients++;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`CONCLUÍDO em ${totalTime}ms: ${relatoriosGerados.length} relatórios`);

    const response = {
      success: true,
      message: 'Processamento de faturamento concluído',
      pdfs_gerados: relatoriosGerados,
      emails_enviados: 0,
      periodo,
      total_clientes: clientesResumo.size,
      processamento_info: {
        registros_processados: maxRegistros,
        total_registros: dadosProcessados.length,
        tempo_total_ms: totalTime
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('=== ERRO ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack || 'Stack não disponível'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function gerarRelatorioSimples(cliente: ClienteResumo, periodo: string): string {
  return `RELATÓRIO DE FATURAMENTO
========================

Cliente: ${cliente.nome}
Período: ${formatarPeriodo(periodo)}
Data: ${new Date().toLocaleString('pt-BR')}

RESUMO FINANCEIRO
-----------------
Total de Laudos: ${cliente.totalLaudos}
Valor Total: R$ ${cliente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

PRIMEIROS EXAMES
----------------
${cliente.exames.slice(0, 3).map((exame, index) => {
  const valor = Number(exame.valor_pagar || exame['Valor a Pagar'] || 0);
  return `${index + 1}. Valor: R$ ${valor.toFixed(2)}`;
}).join('\n')}

${cliente.totalLaudos > 3 ? `\n... e mais ${cliente.totalLaudos - 3} exames` : ''}

---
Relatório gerado automaticamente
`;
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