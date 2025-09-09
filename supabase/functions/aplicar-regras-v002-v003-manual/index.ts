import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

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

    console.log('🔧 APLICAÇÃO MANUAL DAS REGRAS V002/V003 - Volumetria Padrão Retroativo');
    
    // Verificar dados antes da aplicação
    const { count: totalAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');
    
    console.log(`📊 Total registros ANTES: ${totalAntes || 0}`);

    // REGRA V003: Excluir registros com DATA_REALIZACAO >= '2025-06-01'
    console.log('🗑️ Aplicando REGRA V003: Excluindo registros com DATA_REALIZACAO >= 2025-06-01');
    
    const { count: excluidos } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .gte('"DATA_REALIZACAO"', '2025-06-01');

    console.log(`❌ V003: ${excluidos || 0} registros excluídos por DATA_REALIZACAO >= 2025-06-01`);

    // REGRA V002: Manter apenas registros com DATA_LAUDO entre 08/06/2025 e 07/07/2025
    console.log('🔍 Aplicando REGRA V002: Mantendo apenas DATA_LAUDO entre 08/06/2025 e 07/07/2025');
    
    const { count: excluidos_v002 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .or('"DATA_LAUDO".lt.2025-06-08,"DATA_LAUDO".gt.2025-07-07');

    console.log(`❌ V002: ${excluidos_v002 || 0} registros excluídos por DATA_LAUDO fora do período 08/06 a 07/07/2025`);

    // Verificar dados após aplicação
    const { count: totalDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');
    
    console.log(`📊 Total registros DEPOIS: ${totalDepois || 0}`);

    // Verificar faixas de data após aplicação
    const { data: estatisticas } = await supabase
      .from('volumetria_mobilemed')
      .select('"DATA_LAUDO", "DATA_REALIZACAO"')
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .order('"DATA_REALIZACAO"', { ascending: true })
      .limit(5);

    const { data: estatisticas_fim } = await supabase
      .from('volumetria_mobilemed')
      .select('"DATA_LAUDO", "DATA_REALIZACAO"')
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .order('"DATA_REALIZACAO"', { ascending: false })
      .limit(5);

    console.log('📅 Primeiros 5 registros por DATA_REALIZACAO:', estatisticas);
    console.log('📅 Últimos 5 registros por DATA_REALIZACAO:', estatisticas_fim);

    const resultado = {
      success: true,
      regras_aplicadas: ['v002', 'v003'],
      registros_antes: totalAntes || 0,
      registros_depois: totalDepois || 0,
      excluidos_v003: excluidos || 0,
      excluidos_v002: excluidos_v002 || 0,
      total_excluidos: (excluidos || 0) + (excluidos_v002 || 0),
      arquivo_processado: 'volumetria_padrao_retroativo',
      timestamp: new Date().toISOString(),
      observacao: 'V003: Exclui DATA_REALIZACAO >= 01/06/2025 | V002: Mantém DATA_LAUDO entre 08/06 e 07/07/2025'
    };

    console.log('✅ Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na aplicação manual das regras:', error);
    
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