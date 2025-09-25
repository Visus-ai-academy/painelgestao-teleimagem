import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const timestamp = new Date().toISOString();
    
    // Múltiplos tipos de log para teste
    console.log(`🚀 TESTE DE LOGGING INICIADO - ${timestamp}`);
    console.log(`📊 Método: ${req.method}`);
    console.log(`🔗 URL: ${req.url}`);
    console.log(`📋 Headers:`, Object.fromEntries(req.headers.entries()));
    
    // Log de informação
    console.info(`ℹ️ INFO: Sistema de logging está ativo`);
    
    // Log de aviso
    console.warn(`⚠️ WARN: Este é um teste de logging`);
    
    // Log de erro controlado
    console.error(`❌ ERROR: Este é um erro de teste controlado`);
    
    // Log estruturado
    const testData = {
      timestamp,
      test_id: `test_${Date.now()}`,
      status: 'active',
      message: 'Sistema de logging funcionando'
    };
    
    console.log(`🔧 DADOS DE TESTE:`, JSON.stringify(testData, null, 2));
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`✅ TESTE DE LOGGING CONCLUÍDO - ${timestamp}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teste de logging executado com sucesso',
        timestamp,
        logs_generated: 8
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error(`💥 ERRO CRÍTICO NO TESTE:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});