import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo_referencia } = await req.json();

    console.log(`[limpar-dados-inconsistentes] Iniciando limpeza para período: ${periodo_referencia}`);

    // 1. Buscar clientes no faturamento que não existem na volumetria
    const { data: clientesSemVolumetria, error: errorConsulta } = await supabase
      .from('faturamento')
      .select('DISTINCT cliente_nome')
      .eq('periodo_referencia', periodo_referencia);

    if (errorConsulta) {
      throw new Error(`Erro ao consultar faturamento: ${errorConsulta.message}`);
    }

    console.log(`[limpar-dados-inconsistentes] Clientes no faturamento: ${clientesSemVolumetria?.length || 0}`);

    let clientesInconsistentes = [];
    let registrosRemovidos = 0;

    // 2. Para cada cliente do faturamento, verificar se existe na volumetria
    for (const cliente of clientesSemVolumetria || []) {
      const { data: volumetriaData, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('COUNT(*)')
        .eq('EMPRESA', cliente.cliente_nome)
        .eq('periodo_referencia', periodo_referencia)
        .single();

      if (errorVolumetria || !volumetriaData || volumetriaData.count === 0) {
        console.log(`[limpar-dados-inconsistentes] Cliente ${cliente.cliente_nome} não tem volumetria`);
        clientesInconsistentes.push(cliente.cliente_nome);

        // Remover dados inconsistentes do faturamento
        const { error: errorDelete } = await supabase
          .from('faturamento')
          .delete()
          .eq('cliente_nome', cliente.cliente_nome)
          .eq('periodo_referencia', periodo_referencia);

        if (errorDelete) {
          console.error(`[limpar-dados-inconsistentes] Erro ao remover ${cliente.cliente_nome}: ${errorDelete.message}`);
        } else {
          const { count } = await supabase
            .from('faturamento')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_nome', cliente.cliente_nome)
            .eq('periodo_referencia', periodo_referencia);

          registrosRemovidos += count || 0;
          console.log(`[limpar-dados-inconsistentes] Removidos dados de ${cliente.cliente_nome}`);
        }
      }
    }

    // 3. Log da operação
    const resultado = {
      success: true,
      periodo_referencia,
      clientes_inconsistentes: clientesInconsistentes,
      registros_removidos: registrosRemovidos,
      data_limpeza: new Date().toISOString()
    };

    console.log(`[limpar-dados-inconsistentes] Resultado:`, resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[limpar-dados-inconsistentes] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Erro ao limpar dados inconsistentes'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});