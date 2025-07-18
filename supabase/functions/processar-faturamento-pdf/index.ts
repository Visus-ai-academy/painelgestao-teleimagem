import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, periodo } = await req.json();

    console.log('=== PROCESSAR FATURAMENTO PDF ===');
    console.log('Arquivo:', file_path);
    console.log('Período:', periodo);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do faturamento processado
    const { data: faturamentoData, error: faturamentoError } = await supabaseClient
      .from('faturamento_dados')
      .select('*')
      .eq('periodo', periodo);

    if (faturamentoError) {
      console.error('Erro ao buscar dados do faturamento:', faturamentoError);
      throw faturamentoError;
    }

    console.log(`Encontrados ${faturamentoData?.length || 0} registros de faturamento`);

    if (!faturamentoData || faturamentoData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum dado de faturamento encontrado para o período',
          periodo 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Agrupar dados por cliente
    const clientesAgrupados = faturamentoData.reduce((acc: any, item: any) => {
      if (!acc[item.cliente_nome]) {
        acc[item.cliente_nome] = {
          cliente_nome: item.cliente_nome,
          exames: [],
          total_exames: 0,
          valor_total: 0
        };
      }
      acc[item.cliente_nome].exames.push(item);
      acc[item.cliente_nome].total_exames++;
      acc[item.cliente_nome].valor_total += item.valor_bruto;
      return acc;
    }, {});

    console.log(`Dados agrupados para ${Object.keys(clientesAgrupados).length} clientes`);

    // Gerar estrutura de resposta (sem PDF real no backend)
    const resultados = Object.keys(clientesAgrupados).map(clienteNome => {
      const clienteData = clientesAgrupados[clienteNome];
      return {
        cliente: clienteNome,
        total_exames: clienteData.total_exames,
        valor_total: clienteData.valor_total,
        pdf_gerado: true,
        mensagem: 'PDF será gerado no frontend'
      };
    });

    console.log('Processamento concluído com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        clientes: resultados,
        total_clientes: resultados.length,
        periodo
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na função processar-faturamento-pdf:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro interno na função de processamento de PDF'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});