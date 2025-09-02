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

    console.log('🔧 CORREÇÃO FINAL: ONCO MEDICINA INTERNA → ONCOLOGIA');

    // Buscar registros com ONCO MEDICINA INTERNA
    const { data: registros, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, "ESPECIALIDADE", arquivo_fonte')
      .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA');

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros: ${errorBusca.message}`);
    }

    console.log(`📦 Encontrados ${registros?.length || 0} registros para correção`);

    if (!registros || registros.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum registro ONCO MEDICINA INTERNA encontrado',
        registros_corrigidos: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Aplicar correção
    const { data: resultadoUpdate, error: errorUpdate } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        "ESPECIALIDADE": 'ONCOLOGIA',
        updated_at: new Date().toISOString()
      })
      .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA')
      .select('id');

    if (errorUpdate) {
      throw new Error(`Erro ao aplicar correção: ${errorUpdate.message}`);
    }

    const registrosCorrigidos = resultadoUpdate?.length || 0;

    console.log(`✅ Correção aplicada: ${registrosCorrigidos} registros atualizados`);

    // Verificação final
    const { data: verificacaoFinal, error: errorVerificacao } = await supabase
      .from('volumetria_mobilemed')
      .select('id')
      .eq('"ESPECIALIDADE"', 'ONCO MEDICINA INTERNA');

    const resultado = {
      sucesso: true,
      registros_encontrados: registros.length,
      registros_corrigidos: registrosCorrigidos,
      registros_ainda_problematicos: verificacaoFinal?.length || 0,
      correcao_aplicada: 'ONCO MEDICINA INTERNA → ONCOLOGIA',
      data_processamento: new Date().toISOString(),
      status: registrosCorrigidos > 0 ? 'CORREÇÃO_APLICADA' : 'NENHUMA_ALTERAÇÃO_NECESSÁRIA'
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro na correção ONCO MEDICINA INTERNA:', error);
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