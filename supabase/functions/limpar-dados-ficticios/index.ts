import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧹 Iniciando limpeza de dados fictícios...');

    // Executar função de limpeza
    const { data, error } = await supabase.rpc('limpar_dados_ficticios');

    if (error) {
      console.error('❌ Erro ao limpar dados fictícios:', error);
      throw error;
    }

    console.log('✅ Limpeza de dados fictícios concluída:', data);

    return new Response(
      JSON.stringify({
        sucesso: true,
        ...data,
        mensagem: 'Limpeza de dados fictícios concluída com sucesso',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro na limpeza de dados fictícios:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Erro ao limpar dados fictícios',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});