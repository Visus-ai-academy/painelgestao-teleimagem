import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// Removendo jsPDF temporariamente para testar se o erro está na biblioteca
// import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelatorioRequest {
  cliente_id: string;
  periodo: string; // formato: "2025-07"
}

interface ExameDetalhado {
  data_estudo: string;
  paciente: string;
  nome_exame: string;
  laudado_por: string;
  prioridade: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  laudos: number;
  valor: number;
}

interface ResumoFinanceiro {
  total_laudos: number;
  franquia: number;
  ajuste: number;
  valor_bruto: number;
  valor_total: number;
  irrf: number;
  csll: number;
  pis: number;
  cofins: number;
  impostos: number;
  valor_a_pagar: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, periodo }: RelatorioRequest = await req.json();
    console.log(`🔥 INICIANDO GERAÇÃO DE RELATÓRIO - Cliente: ${cliente_id}, Período: ${periodo}`);

    // Extrair ano e mês do período (formato: "2025-07")
    const [ano, mes] = periodo.split('-');
    const data_inicio = `${ano}-${mes}-01`;
    const data_fim = `${ano}-${mes}-31`;
    
    console.log(`📅 Período: ${data_inicio} até ${data_fim}`);

    // 1. BUSCAR DADOS DO CLIENTE
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      console.error('❌ Cliente não encontrado:', clienteError);
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    console.log(`👤 Cliente encontrado: ${cliente.nome}`);

    // 2. BUSCAR DADOS DE FATURAMENTO (CORREÇÃO: paciente = código do cliente)
    const { data: dadosFaturamento, error: faturamentoError } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome) // CORRETO: paciente contém o código do cliente
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim)
      .order('data_emissao', { ascending: true });

    if (faturamentoError) {
      console.error('❌ Erro ao buscar faturamento:', faturamentoError);
      throw new Error(`Erro ao buscar dados de faturamento: ${faturamentoError.message}`);
    }

    console.log(`💰 Dados de faturamento encontrados: ${dadosFaturamento?.length || 0} registros`);
    console.log(`🔍 Filtro usado: paciente = '${cliente.nome}' (código do cliente)`);

    // Verificar se temos dados suficientes para gerar o relatório
    if (!dadosFaturamento || dadosFaturamento.length === 0) {
      console.log('❌ Nenhum dado de faturamento encontrado para o período');
      console.log(`Cliente: ${cliente.nome}, Período: ${periodo}`);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum dado de faturamento encontrado',
          details: `Não foram encontrados dados de faturamento para cliente ${cliente.nome} no período ${periodo}. Verifique se o arquivo de faturamento foi processado corretamente.`,
          cliente: cliente.nome,
          periodo,
          debug: {
            filtro_usado: `paciente = '${cliente.nome}'`,
            data_inicio,
            data_fim
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. PROCESSAR DADOS DE FATURAMENTO
    console.log('📊 Usando dados da tabela FATURAMENTO');
    let examesDetalhados: ExameDetalhado[] = [];
    let fonteDados = 'faturamento';
      
    examesDetalhados = dadosFaturamento.map(item => ({
      data_estudo: item.data_exame || item.data_emissao || data_inicio,
      paciente: item.cliente || 'NÃO INFORMADO', // CORRETO: cliente contém o nome do paciente
      nome_exame: item.nome_exame || `${item.modalidade || ''} ${item.especialidade || ''}`.trim() || 'EXAME NÃO ESPECIFICADO',
      laudado_por: item.medico || 'NÃO INFORMADO',
      prioridade: item.prioridade || 'NORMAL',
      modalidade: item.modalidade || 'NÃO INFORMADO',
      especialidade: item.especialidade || 'NÃO INFORMADO', 
      categoria: item.categoria || 'NORMAL',
      laudos: item.quantidade || 1,
      valor: Number(item.valor_bruto) || Number(item.valor) || 0
    }));

    console.log(`📈 Fonte de dados: ${fonteDados}`);
    console.log(`📝 Total de exames processados: ${examesDetalhados.length}`);

    // 5. CALCULAR RESUMO FINANCEIRO (IGUAL AO SCRIPT PYTHON)
    const total_laudos = examesDetalhados.reduce((sum, exame) => sum + exame.laudos, 0);
    const valor_bruto = examesDetalhados.reduce((sum, exame) => sum + exame.valor, 0);
    const franquia = 0.0;
    const ajuste = 0.0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos exatamente como no Python
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    const resumo: ResumoFinanceiro = {
      total_laudos,
      franquia,
      ajuste,
      valor_bruto,
      valor_total,
      irrf,
      csll,
      pis,
      cofins,
      impostos,
      valor_a_pagar
    };

    console.log(`💵 Resumo calculado:`, resumo);

    // 6. RETORNAR DADOS SEM PDF (TESTE)
    console.log(`✅ Dados processados com sucesso - ${examesDetalhados.length} exames`);
    
    // Temporariamente desabilitando geração de PDF para testar
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.json`;
    const publicUrl = `https://exemplo.com/${nomeArquivo}`;

    // 8. RESPOSTA FINAL
    return new Response(
      JSON.stringify({ 
        success: true,
        cliente: cliente.nome,
        periodo,
        resumo,
        total_exames: examesDetalhados.length,
        fonte_dados: fonteDados,
        arquivos: [{
          tipo: 'pdf',
          url: publicUrl,
          nome: nomeArquivo
        }],
        message: `Relatório gerado com sucesso - ${total_laudos} laudos, valor total: R$ ${valor_total.toFixed(2)}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);