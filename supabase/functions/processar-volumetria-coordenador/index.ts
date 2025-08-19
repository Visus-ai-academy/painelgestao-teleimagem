import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, upload_id } = await req.json();
    
    console.log('🎯 [COORDENADOR] Iniciando orquestração V2:', {
      file_path,
      arquivo_fonte,
      upload_id,
      periodo_referencia
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Chamar staging-light diretamente
    console.log('🚀 [COORDENADOR] Chamando staging-light...');
    
    const stagingResponse = await supabase.functions.invoke(
      'processar-volumetria-staging-light',
      {
        body: {
          file_path,
          arquivo_fonte,
          periodo_referencia: periodo_referencia || 'jun/25'
        }
      }
    );

    console.log('📊 [COORDENADOR] Resposta staging raw:', stagingResponse);

    if (stagingResponse.error) {
      console.error('❌ [COORDENADOR] Erro no staging:', stagingResponse.error);
      throw new Error(`Staging falhou: ${stagingResponse.error.message}`);
    }

    const stagingData = stagingResponse.data;
    console.log('✅ [COORDENADOR] Staging dados:', stagingData);

    if (!stagingData?.success) {
      throw new Error('Staging não retornou sucesso');
    }

    // 2. Chamar background processing imediatamente (sem waitUntil por enquanto)
    console.log('🏗️ [COORDENADOR] Chamando background...');
    
    const backgroundResponse = await supabase.functions.invoke(
      'processar-staging-background',
      {
        body: {
          upload_id: stagingData.upload_id || upload_id,
          arquivo_fonte,
          periodo_referencia: periodo_referencia || 'jun/25'
        }
      }
    );

    console.log('📊 [COORDENADOR] Resposta background raw:', backgroundResponse);

    if (backgroundResponse.error) {
      console.error('❌ [COORDENADOR] Erro no background:', backgroundResponse.error);
      // Não falhar por erro no background, apenas logar
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processamento coordenado concluído',
        staging: stagingData,
        background: backgroundResponse.data,
        upload_id: stagingData?.upload_id || upload_id,
        stats: {
          staging_inseridos: stagingData?.registros_inseridos || 0,
          staging_processados: stagingData?.registros_processados || 0,
          background_processados: backgroundResponse.data?.registros_processados || 0
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no coordenador: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});