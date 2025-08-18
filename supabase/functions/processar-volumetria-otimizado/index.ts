import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ⚡ NOVA ARQUITETURA DE STAGING - UPLOAD ULTRARRÁPIDO
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, periodo_processamento } = await req.json();
    
    console.log('🚀 NOVA ARQUITETURA - Redirecionando para staging', {
      file_path,
      arquivo_fonte,
      periodo_referencia
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // REDIRECIONAR PARA PROCESSAMENTO EM STAGING
    const { data: stagingResult, error: stagingError } = await supabaseClient.functions.invoke('processar-volumetria-staging', {
      body: { 
        file_path,
        arquivo_fonte,
        periodo_referencia,
        periodo_processamento
      }
    });

    if (stagingError) {
      console.error('❌ Erro no processamento staging:', stagingError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro no processamento de staging',
          details: stagingError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Staging processado com sucesso:', stagingResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Upload processado via nova arquitetura de staging',
        staging_result: stagingResult,
        nova_arquitetura: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na nova arquitetura:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});