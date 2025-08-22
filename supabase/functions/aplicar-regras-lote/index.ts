import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔄 APLICANDO REGRAS EM LOTE PARA: ${arquivo_fonte || 'TODOS'}`);
    console.log(`🚫 TESTE: TODAS as regras de exclusão desabilitadas para teste`);

    // Sequência de regras a serem aplicadas
    const regras = [
      // 'aplicar-exclusao-clientes-especificos',  // ← DESABILITADA PARA TESTE
      // 'aplicar-exclusoes-periodo',              // ← DESABILITADA PARA TESTE
      // 'aplicar-filtro-data-laudo',              // ← DESABILITADA PARA TESTE 
      'aplicar-regras-tratamento',
      'aplicar-correcao-modalidade-rx',
      'aplicar-correcao-modalidade-ot',
      'aplicar-substituicao-especialidade-categoria',
      'aplicar-regra-colunas-musculo-neuro',
      'aplicar-tipificacao-faturamento',
      'aplicar-validacao-cliente',
      'aplicar-regras-quebra-exames'
    ];

    const resultados = [];
    let totalProcessado = 0;

    for (const regra of regras) {
      try {
        console.log(`🔧 Aplicando regra: ${regra}`);
        
        // Diferentes regras precisam de parâmetros diferentes
        let body = { arquivo_fonte };
        
        if (['aplicar-exclusoes-periodo', 'aplicar-filtro-data-laudo'].includes(regra)) {
          body = { arquivo_fonte, periodo_referencia };
          
          // TESTE: Desabilitar regras v002, v003 e v031 para teste
          if (regra === 'aplicar-exclusoes-periodo') {
            body = { 
              arquivo_fonte, 
              periodo_referencia, 
              disable_rules: ['v002', 'v003', 'v031'] 
            };
            console.log(`🚫 TESTE: Desabilitando regras v002, v003 e v031 em ${regra}`);
          }
        }
        
        const { data, error } = await supabaseClient.functions.invoke(regra, { body });

        if (error) {
          console.error(`❌ Erro na regra ${regra}:`, error);
          resultados.push({
            regra,
            status: 'erro',
            erro: error.message,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`✅ Regra ${regra} aplicada com sucesso:`, data);
          resultados.push({
            regra,
            status: 'sucesso',
            resultado: data,
            timestamp: new Date().toISOString()
          });
          
          if (data?.registros_processados) {
            totalProcessado += data.registros_processados;
          }
        }

        // Pequena pausa entre regras para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`💥 Falha crítica na regra ${regra}:`, err);
        resultados.push({
          regra,
          status: 'falha_critica',
          erro: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log final de auditoria
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'volumetria_mobilemed',
        operation: 'APLICAR_REGRAS_LOTE',
        record_id: arquivo_fonte || 'TODOS',
        new_data: {
          total_regras: regras.length,
          total_processado: totalProcessado,
          resultados: resultados,
          arquivo_fonte: arquivo_fonte
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log('🎉 PROCESSAMENTO EM LOTE CONCLUÍDO!');

    return new Response(JSON.stringify({
      success: true,
      total_regras: regras.length,
      total_processado: totalProcessado,
      arquivo_fonte: arquivo_fonte || 'TODOS',
      resultados: resultados,
      data_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});