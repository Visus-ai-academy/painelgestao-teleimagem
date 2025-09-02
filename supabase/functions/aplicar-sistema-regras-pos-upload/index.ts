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

    const { arquivo_fonte, lote_upload, periodo_referencia } = await req.json();

    console.log(`🔄 APLICANDO SISTEMA COMPLETO DE REGRAS PARA: ${arquivo_fonte}`);

    const regrasAplicar = [
      // Regras de mapeamento e limpeza
      'aplicar-mapeamento-nome-cliente',
      'aplicar-de-para-prioridades',
      
      // Regras de correção de modalidade
      'aplicar-correcao-modalidade-rx',
      'aplicar-correcao-modalidade-ot',
      
      // Regras de categorização
      'aplicar-categorias-cadastro',
      'aplicar-especialidade-automatica',
      
      // Regras de tipificação
      'aplicar-tipificacao-faturamento',
      'aplicar-tipificacao-retroativa',
      
      // Regras de validação
      'aplicar-validacao-cliente',
      
      // Regras v002/v003 (retroativos)
      'aplicar-regras-v002-v003-manual'
    ];

    const resultados = [];
    let totalRegrasAplicadas = 0;

    for (const regra of regrasAplicar) {
      try {
        console.log(`🔧 Aplicando regra: ${regra}`);
        
        const { data: resultado, error } = await supabase.functions.invoke(regra, {
          body: { 
            arquivo_fonte, 
            lote_upload, 
            periodo_referencia,
            forcar_aplicacao: true 
          }
        });

        if (error) {
          console.error(`❌ Erro na regra ${regra}:`, error);
          resultados.push({
            regra,
            sucesso: false,
            erro: error.message || 'Erro desconhecido'
          });
        } else {
          console.log(`✅ Regra ${regra} aplicada com sucesso:`, resultado);
          resultados.push({
            regra,
            sucesso: true,
            resultado
          });
          totalRegrasAplicadas++;
        }
      } catch (error) {
        console.error(`❌ Erro ao aplicar regra ${regra}:`, error);
        resultados.push({
          regra,
          sucesso: false,
          erro: error.message
        });
      }
    }

    // Verificar resultado final
    const { data: verificacao } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        arquivo_fonte,
        COUNT(*) as total,
        COUNT(CASE WHEN "CATEGORIA" IS NOT NULL AND "CATEGORIA" != '' AND "CATEGORIA" != 'SC' THEN 1 END) as com_categoria,
        COUNT(CASE WHEN "ESPECIALIDADE" IS NOT NULL AND "ESPECIALIDADE" != '' AND "ESPECIALIDADE" != 'GERAL' THEN 1 END) as com_especialidade,
        COUNT(CASE WHEN tipo_faturamento IS NOT NULL THEN 1 END) as com_tipificacao
      `)
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('lote_upload', lote_upload);

    const relatorioFinal = {
      sucesso: true,
      arquivo_fonte,
      lote_upload,
      periodo_referencia,
      total_regras_tentadas: regrasAplicar.length,
      total_regras_aplicadas: totalRegrasAplicadas,
      porcentagem_sucesso: Math.round((totalRegrasAplicadas / regrasAplicar.length) * 100),
      detalhes_regras: resultados,
      verificacao_final: verificacao?.[0] || null,
      data_processamento: new Date().toISOString()
    };

    console.log('📊 Relatório final:', relatorioFinal);

    return new Response(JSON.stringify(relatorioFinal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral no sistema de regras:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});