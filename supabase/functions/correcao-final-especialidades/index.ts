import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 CORREÇÃO FINAL DAS ESPECIALIDADES PROBLEMÁTICAS');

    // 1. Corrigir ONCO MEDICINA INTERNA → ONCOLOGIA
    console.log('🔄 Corrigindo ONCO MEDICINA INTERNA → ONCOLOGIA');
    const { count: oncoCount, error: oncoError } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": 'ONCOLOGIA',
        updated_at: new Date().toISOString()
      })
      .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA')
      .select('*', { count: 'exact' });

    if (oncoError) {
      console.error('❌ Erro ao corrigir ONCO MEDICINA INTERNA:', oncoError);
    } else {
      console.log(`✅ ONCO MEDICINA INTERNA → ONCOLOGIA: ${oncoCount || 0} registros`);
    }

    // 2. REMOVIDA correção incorreta de MEDICINA INTERNA
    console.log('⚠️  MEDICINA INTERNA não será alterada (sem instrução do usuário)');
    const medicinaCount = 0;
    const medicinaError = null;

    // 3. Verificação final
    const { data: verificacaoFinal } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESPECIALIDADE"', { count: 'exact' })
      .in('"ESPECIALIDADE"', ['ONCO MEDICINA INTERNA', 'MEDICINA INTERNA']);

    // 4. Status geral após correções
    const { data: statusGeral } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        COUNT(*) as total,
        COUNT(CASE WHEN "ESPECIALIDADE" = 'ONCOLOGIA' THEN 1 END) as oncologia,
        COUNT(CASE WHEN "ESPECIALIDADE" = 'CLINICA MEDICA' THEN 1 END) as clinica_medica
      `);

    const resultado = {
      sucesso: true,
      correcoes_aplicadas: {
        onco_medicina_interna: {
          registros_corrigidos: oncoCount || 0,
          erro: oncoError?.message || null
        },
        medicina_interna: {
          registros_corrigidos: medicinaCount || 0,
          erro: medicinaError?.message || null
        }
      },
      total_registros_corrigidos: (oncoCount || 0) + (medicinaCount || 0),
      registros_ainda_problematicos: verificacaoFinal?.length || 0,
      status_geral: statusGeral?.[0] || null,
      data_processamento: new Date().toISOString()
    };

    console.log('📊 Resultado final da correção:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na correção final:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});