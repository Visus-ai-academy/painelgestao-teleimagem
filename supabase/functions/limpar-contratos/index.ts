import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🗑️ Iniciando limpeza de contratos...');

    // Contar contratos antes da limpeza
    const { count: totalAntes, error: countError } = await supabaseClient
      .from('contratos_clientes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Erro ao contar contratos: ${countError.message}`);
    }

    console.log(`📊 Total de contratos antes da limpeza: ${totalAntes}`);

    // Deletar todos os contratos
    const { error: deleteError } = await supabaseClient
      .from('contratos_clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo

    if (deleteError) {
      throw new Error(`Erro ao deletar contratos: ${deleteError.message}`);
    }

    console.log(`✅ ${totalAntes} contratos deletados com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${totalAntes} contratos deletados com sucesso`,
        contratosDeletados: totalAntes
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao limpar contratos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
