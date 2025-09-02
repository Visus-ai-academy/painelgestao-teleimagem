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

    console.log('🔧 CORREÇÃO FORÇADA DE ESPECIALIDADES PROBLEMÁTICAS');

    const mapeamentos = [
      { de: 'ONCO MEDICINA INTERNA', para: 'ONCOLOGIA' },
      { de: 'Colunas', para: 'ORTOPEDIA' },
      { de: 'MEDICINA INTERNA', para: 'CLINICA MEDICA' },
      { de: 'ONCO', para: 'ONCOLOGIA' }
    ];

    const resultados = [];
    
    for (const mapa of mapeamentos) {
      console.log(`🔄 Corrigindo: ${mapa.de} → ${mapa.para}`);
      
      const { data: registros, error: errorBusca } = await supabase
        .from('volumetria_mobilemed')
        .select('id')
        .eq('"ESPECIALIDADE"', mapa.de);

      if (errorBusca) {
        console.error(`❌ Erro ao buscar ${mapa.de}:`, errorBusca);
        resultados.push({
          mapeamento: `${mapa.de} → ${mapa.para}`,
          sucesso: false,
          erro: errorBusca.message,
          registros_afetados: 0
        });
        continue;
      }

      if (registros && registros.length > 0) {
        const { data: atualizado, error: errorUpdate } = await supabase
          .from('volumetria_mobilemed')
          .update({ 
            "ESPECIALIDADE": mapa.para,
            updated_at: new Date().toISOString()
          })
          .eq('"ESPECIALIDADE"', mapa.de)
          .select('id');

        if (errorUpdate) {
          console.error(`❌ Erro ao atualizar ${mapa.de}:`, errorUpdate);
          resultados.push({
            mapeamento: `${mapa.de} → ${mapa.para}`,
            sucesso: false,
            erro: errorUpdate.message,
            registros_afetados: 0
          });
        } else {
          console.log(`✅ ${mapa.de} → ${mapa.para}: ${atualizado?.length || 0} registros`);
          resultados.push({
            mapeamento: `${mapa.de} → ${mapa.para}`,
            sucesso: true,
            registros_afetados: atualizado?.length || 0
          });
        }
      } else {
        console.log(`ℹ️ Nenhum registro encontrado para: ${mapa.de}`);
        resultados.push({
          mapeamento: `${mapa.de} → ${mapa.para}`,
          sucesso: true,
          registros_afetados: 0
        });
      }
    }

    // Verificação final
    const { data: verificacao } = await supabase
      .from('volumetria_mobilemed')
      .select('"ESPECIALIDADE"', { count: 'exact' })
      .in('"ESPECIALIDADE"', mapeamentos.map(m => m.de));

    const totalCorrigido = resultados.reduce((acc, r) => acc + r.registros_afetados, 0);

    const resultado = {
      sucesso: true,
      total_mapeamentos: mapeamentos.length,
      total_registros_corrigidos: totalCorrigido,
      registros_ainda_problematicos: verificacao?.length || 0,
      detalhes_por_mapeamento: resultados,
      data_processamento: new Date().toISOString()
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na correção de especialidades:', error);
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message,
      detalhes: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});