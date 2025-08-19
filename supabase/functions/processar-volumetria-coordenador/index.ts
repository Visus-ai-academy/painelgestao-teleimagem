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

    // 1. Chamar staging (função confiável)
    console.log('🚀 [COORDENADOR] Chamando staging...');
    
    // Buscar período de referência ativo do sistema se não fornecido
    let periodoAtivo = periodo_referencia;
    if (!periodoAtivo) {
      const { data: periodoConfig } = await supabase
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'periodo_referencia_ativo')
        .single();
      
      periodoAtivo = periodoConfig?.valor || 'jun/25';
    }

    const stagingResponse = await supabase.functions.invoke(
      'upload-direto-sucesso',
      {
        body: {
          file_path,
          arquivo_fonte,
          periodo: periodoAtivo
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

    // 2. PROCESSAMENTO CONCLUÍDO - Staging já fez todo o trabalho necessário
    console.log('✅ [COORDENADOR] Processamento concluído no staging - sem necessidade de background');
    
    const backgroundResponse = {
      data: {
        success: true,
        message: 'Processamento completo no staging',
        registros_processados: stagingData?.registros_inseridos || 0
      },
      error: null
    };

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