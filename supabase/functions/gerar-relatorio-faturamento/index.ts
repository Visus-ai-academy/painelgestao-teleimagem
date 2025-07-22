import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelatorioRequest {
  cliente_id: string;
  periodo: string; // formato: "2025-07"
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
    const data_inicio = `${ano}-${mes.padStart(2, '0')}-01`;
    
    // Calcular último dia do mês
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const data_fim = `${ano}-${mes.padStart(2, '0')}-${ultimoDia.toString().padStart(2, '0')}`;
    
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

    // 2. BUSCAR DADOS DE FATURAMENTO
    const { data: dadosFaturamento, error: faturamentoError } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome) // paciente contém o código do cliente
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim)
      .order('data_emissao', { ascending: true });

    if (faturamentoError) {
      console.error('❌ Erro ao buscar faturamento:', faturamentoError);
      throw new Error(`Erro ao buscar dados de faturamento: ${faturamentoError.message}`);
    }

    console.log(`💰 Dados de faturamento encontrados: ${dadosFaturamento?.length || 0} registros`);

    // Verificar se temos dados suficientes para gerar o relatório
    if (!dadosFaturamento || dadosFaturamento.length === 0) {
      console.log('❌ Nenhum dado de faturamento encontrado para o período');
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum dado de faturamento encontrado',
          details: `Não foram encontrados dados de faturamento para cliente ${cliente.nome} no período ${periodo}.`,
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

    // 3. CALCULAR RESUMO FINANCEIRO
    const total_laudos = dadosFaturamento.reduce((sum, item) => sum + (item.quantidade || 1), 0);
    const valor_bruto = dadosFaturamento.reduce((sum, item) => sum + (Number(item.valor_bruto) || Number(item.valor) || 0), 0);
    const franquia = 0.0;
    const ajuste = 0.0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    const resumo = {
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

    // 4. RESPOSTA FINAL
    return new Response(
      JSON.stringify({ 
        success: true,
        cliente: cliente.nome,
        periodo,
        resumo,
        total_exames: dadosFaturamento.length,
        fonte_dados: 'faturamento',
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