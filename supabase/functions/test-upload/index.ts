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
    console.log('🧪 [TEST] Iniciando teste básico...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('✅ [TEST] Cliente Supabase criado');

    // Testar conexão simples
    const { data: testData, error: testError } = await supabase
      .from('processamento_uploads')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ [TEST] Erro na conexão:', testError);
      throw testError;
    }

    console.log('✅ [TEST] Conexão OK');

    return new Response(JSON.stringify({
      success: true,
      message: 'Teste básico passou',
      connection: 'OK'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [TEST] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});