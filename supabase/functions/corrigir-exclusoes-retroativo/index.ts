import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Iniciando correção de exclusões retroativas...');

    // Parâmetros fixos para jun/25
    const dataLimiteRealizacao = '2025-06-01'; // v003: excluir realizações >= jun/2025
    const inicioFaturamento = '2025-06-08';    // v002: manter laudos entre 08/06 e 07/07
    const fimFaturamento = '2025-07-07';

    let totalExcluidos = 0;
    const detalhes = [];

    // REGRA v003: Excluir registros com DATA_REALIZACAO >= 2025-06-01 (volumetria_padrao_retroativo)
    console.log(`📋 REGRA v003 - Excluindo realizações >= ${dataLimiteRealizacao}`);
    
    const { error: errorV003, count: countV003 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .gte('DATA_REALIZACAO', dataLimiteRealizacao);

    if (errorV003) {
      console.error('❌ Erro ao aplicar regra v003:', errorV003);
      detalhes.push(`ERRO v003: ${errorV003.message}`);
    } else {
      const deletedCountV003 = countV003 || 0;
      totalExcluidos += deletedCountV003;
      detalhes.push(`REGRA v003: ${deletedCountV003} registros excluídos por DATA_REALIZACAO >= ${dataLimiteRealizacao}`);
      console.log(`✅ REGRA v003: ${deletedCountV003} registros excluídos`);
    }

    // REGRA v002: Excluir registros com DATA_LAUDO fora do período (volumetria_padrao_retroativo)
    console.log(`📋 REGRA v002 - Excluindo laudos < ${inicioFaturamento} OU > ${fimFaturamento}`);
    
    const { error: errorV002, count: countV002 } = await supabase
      .from('volumetria_mobilemed')
      .delete({ count: 'exact' })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo')
      .or(`DATA_LAUDO.lt.${inicioFaturamento},DATA_LAUDO.gt.${fimFaturamento}`);

    if (errorV002) {
      console.error('❌ Erro ao aplicar regra v002:', errorV002);
      detalhes.push(`ERRO v002: ${errorV002.message}`);
    } else {
      const deletedCountV002 = countV002 || 0;
      totalExcluidos += deletedCountV002;
      detalhes.push(`REGRA v002: ${deletedCountV002} registros excluídos por DATA_LAUDO fora do período ${inicioFaturamento} a ${fimFaturamento}`);
      console.log(`✅ REGRA v002: ${deletedCountV002} registros excluídos`);
    }

    // Verificar situação final
    const { data: finalStats, error: statsError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('arquivo_fonte', 'volumetria_padrao_retroativo');

    if (statsError) {
      console.error('❌ Erro ao verificar stats finais:', statsError);
    } else {
      console.log(`📊 Registros restantes: ${finalStats?.count || 0}`);
      detalhes.push(`Registros restantes após correção: ${finalStats?.count || 0}`);
    }

    // Log da operação
    await supabase.from('audit_logs').insert({
      table_name: 'volumetria_mobilemed',
      operation: 'CORRIGIR_EXCLUSOES_RETROATIVO',
      record_id: 'volumetria_padrao_retroativo',
      new_data: {
        total_excluidos: totalExcluidos,
        detalhes: detalhes,
        regras_aplicadas: ['v002', 'v003']
      },
      user_email: 'system',
      severity: 'warning'
    });

    console.log(`🎯 Correção concluída. Total excluído: ${totalExcluidos}`);

    return new Response(JSON.stringify({
      success: true,
      total_excluidos: totalExcluidos,
      detalhes: detalhes,
      registros_restantes: finalStats?.count || 0,
      arquivo_processado: 'volumetria_padrao_retroativo',
      regras_aplicadas: ['v002', 'v003']
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});