import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 TESTE MANUAL DAS REGRAS V002/V003');
    
    // Verificar dados antes da aplicação
    const { count: totalAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');
    
    console.log(`📊 Total registros ANTES: ${totalAntes || 0}`);
    
    // Aplicar regras v002/v003 através da função existente
    console.log('🔧 Chamando aplicar-exclusoes-periodo...');
    
    const { data: resultado, error } = await supabase.functions.invoke(
      'aplicar-exclusoes-periodo',
      {
        body: {
          arquivo_fonte: 'volumetria_padrao_retroativo',
          periodo_referencia: 'jun/25'
        }
      }
    );

    console.log('📥 Resultado da aplicação:', resultado);
    console.log('❌ Erro (se houver):', error);

    // Verificar dados após aplicação
    const { count: totalDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');
    
    console.log(`📊 Total registros DEPOIS: ${totalDepois || 0}`);

    // Verificar algumas datas específicas
    const { data: amostraData } = await supabase
      .from('volumetria_mobilemed')
      .select('"DATA_LAUDO", "DATA_REALIZACAO"')
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .limit(10);

    console.log('📅 Amostra de datas restantes:', amostraData);

    return new Response(JSON.stringify({
      success: true,
      teste_executado: true,
      registros_antes: totalAntes || 0,
      registros_depois: totalDepois || 0,
      registros_excluidos: (totalAntes || 0) - (totalDepois || 0),
      resultado_funcao: resultado,
      erro_funcao: error,
      amostra_data: amostraData,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no teste:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});