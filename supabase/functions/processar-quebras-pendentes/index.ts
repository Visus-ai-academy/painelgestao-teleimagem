import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('🔧 [QUEBRAS-PENDENTES] Iniciando processamento de quebras:', {
      arquivo_fonte,
      periodo_referencia
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Executar função RPC que processa quebras automaticamente
    const { data: quebrasResult, error: quebrasError } = await supabase
      .rpc('aplicar_regras_quebra_exames', {
        arquivo_fonte_param: arquivo_fonte
      });

    if (quebrasError) {
      console.error('❌ [QUEBRAS-PENDENTES] Erro ao aplicar quebras:', quebrasError);
      throw quebrasError;
    }

    console.log('✅ [QUEBRAS-PENDENTES] Quebras processadas:', quebrasResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quebras processadas com sucesso',
        quebras_resultado: quebrasResult,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [QUEBRAS-PENDENTES] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});