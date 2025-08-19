import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🎯 COORDENADOR DE PROCESSAMENTO - Orquestra todo o fluxo de staging
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = await req.json();
    
    console.log('🎯 [COORDENADOR] Iniciando orquestração do processamento:', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. ETAPA STAGING - Processar Excel para staging
    console.log('📋 [COORDENADOR] Etapa 1: Processando para staging...');
    
    const { data: stagingResult, error: stagingError } = await supabaseClient.functions.invoke('processar-volumetria-staging', {
      body: { 
        file_path,
        arquivo_fonte,
        periodo_referencia,
        periodo_processamento
      }
    });

    if (stagingError) {
      console.error('❌ [COORDENADOR] Erro na etapa de staging:', stagingError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro no processamento de staging',
          details: stagingError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [COORDENADOR] Staging completado:', stagingResult);

    // 2. ETAPA BACKGROUND - Aplicar regras e mover para tabela final
    console.log('🔄 [COORDENADOR] Etapa 2: Processamento em background...');
    
    const { data: backgroundResult, error: backgroundError } = await supabaseClient.functions.invoke('processar-staging-background', {
      body: {
        upload_id: stagingResult.upload_id,
        arquivo_fonte,
        periodo_referencia
      }
    });

    if (backgroundError) {
      console.error('❌ [COORDENADOR] Erro no processamento background:', backgroundError);
      
      // Atualizar status do upload como erro
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'error',
          detalhes_erro: {
            etapa: 'background',
            erro: backgroundError.message,
            timestamp: new Date().toISOString()
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', stagingResult.upload_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro no processamento background',
          upload_id: stagingResult.upload_id,
          details: backgroundError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [COORDENADOR] Background completado:', backgroundResult);

    // 3. RESULTADO FINAL
    const resultado = {
      success: true,
      message: 'Processamento completo via arquitetura de staging',
      upload_id: stagingResult.upload_id,
      staging_stats: {
        registros_staging: stagingResult.registros_inseridos_staging,
        registros_erro_staging: stagingResult.registros_erro_staging
      },
      background_stats: {
        registros_processados: backgroundResult.registros_processados,
        registros_inseridos: backgroundResult.registros_inseridos,
        registros_erro: backgroundResult.registros_erro,
        regras_aplicadas: backgroundResult.regras_aplicadas
      },
      total_stats: {
        total_registros: stagingResult.registros_inseridos_staging,
        registros_finais: backgroundResult.registros_inseridos,
        taxa_sucesso: backgroundResult.registros_inseridos / stagingResult.registros_inseridos_staging * 100
      }
    };

    console.log('🎯 [COORDENADOR] Processamento completo:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR] Erro crítico:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});