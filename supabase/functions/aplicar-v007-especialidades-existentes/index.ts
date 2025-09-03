import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    console.log('🔄 Iniciando aplicação da regra v007 - Correções de especialidades problemáticas');
    
    let totalCorrecoesColunas = 0;
    let totalCorrecoesOncoMedInt = 0;
    let totalErros = 0;

    // 1. Corrigir COLUNAS → MUSCULO ESQUELETICO
    console.log('📋 Corrigindo especialidade COLUNAS → MUSCULO ESQUELETICO');
    
    const { error: errorColunas } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        'ESPECIALIDADE': 'MUSCULO ESQUELETICO',
        updated_at: new Date().toISOString()
      })
      .eq('"ESPECIALIDADE"', 'COLUNAS');

    if (errorColunas) {
      console.error('❌ Erro ao corrigir COLUNAS:', errorColunas);
      totalErros++;
    } else {
      // Contar quantos foram atualizados
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('"ESPECIALIDADE"', 'MUSCULO ESQUELETICO')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Últimos 60 segundos
      
      totalCorrecoesColunas = count || 0;
      console.log(`✅ ${totalCorrecoesColunas} registros COLUNAS corrigidos para MUSCULO ESQUELETICO`);
    }

    // 2. Corrigir ONCO MEDICINA INTERNA → MEDICINA INTERNA
    console.log('📋 Corrigindo especialidade ONCO MEDICINA INTERNA → MEDICINA INTERNA');
    
    const { error: errorOncoMed } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        'ESPECIALIDADE': 'MEDICINA INTERNA',
        updated_at: new Date().toISOString()
      })
      .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA');

    if (errorOncoMed) {
      console.error('❌ Erro ao corrigir ONCO MEDICINA INTERNA:', errorOncoMed);
      totalErros++;
    } else {
      // Contar quantos foram atualizados
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('"ESPECIALIDADE"', 'MEDICINA INTERNA')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Últimos 60 segundos
      
      totalCorrecoesOncoMedInt = count || 0;
      console.log(`✅ ${totalCorrecoesOncoMedInt} registros ONCO MEDICINA INTERNA corrigidos para MEDICINA INTERNA`);
    }

    // Verificar resultado final
    const { data: verificacao, error: errorVerif } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESPECIALIDADE"')
      .in('"ESPECIALIDADE"', ['COLUNAS', 'ONCO MEDICINA INTERNA']);

    const registrosRestantes = verificacao?.length || 0;

    // Log da operação no audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_V007_ESPECIALIDADES',
        record_id: 'correções_massivas',
        new_data: {
          total_correcoes_colunas: totalCorrecoesColunas,
          total_correcoes_onco_med_int: totalCorrecoesOncoMedInt,
          total_erros: totalErros,
          registros_restantes: registrosRestantes,
          timestamp: new Date().toISOString()
        },
        user_email: 'system',
        severity: totalErros > 0 ? 'warning' : 'info'
      });

    const resultado = {
      sucesso: totalErros === 0,
      total_correcoes_colunas: totalCorrecoesColunas,
      total_correcoes_onco_med_int: totalCorrecoesOncoMedInt,
      total_erros: totalErros,
      registros_restantes: registrosRestantes,
      observacoes: `Regra v007 aplicada. ${totalCorrecoesColunas + totalCorrecoesOncoMedInt} especialidades corrigidas, ${registrosRestantes} registros ainda precisam de correção.`
    };

    console.log('✅ Regra v007 aplicada com sucesso:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Erro na aplicação da regra v007:', error);
    
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
        observacoes: 'Erro ao aplicar regra v007 - Correções de especialidades problemáticas'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});