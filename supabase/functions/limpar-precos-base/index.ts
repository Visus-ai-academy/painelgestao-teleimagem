import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Functions: {
      limpar_todos_precos: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    console.log('🧹 Iniciando limpeza da base de preços...');

    // Executar função de limpeza de preços
    const { error: cleanError } = await supabase.rpc('limpar_todos_precos');

    if (cleanError) {
      console.error('❌ Erro ao limpar preços:', cleanError);
      throw cleanError;
    }

    console.log('✅ Base de preços limpa com sucesso');

    // Verificar se realmente foi limpo
    const { count } = await supabase
      .from('precos_servicos')
      .select('id', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        sucesso: true,
        mensagem: 'Base de preços limpa com sucesso',
        registros_restantes: count || 0,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro na limpeza de preços:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Erro ao limpar base de preços',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});