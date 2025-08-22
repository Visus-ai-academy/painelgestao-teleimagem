import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Iniciando limpeza de registros rejeitados...');

    // Limpar todos os registros rejeitados
    const { error: deleteError, count } = await supabaseClient
      .from('registros_rejeitados_processamento')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos exceto um ID impossível

    if (deleteError) {
      console.error('❌ Erro ao limpar registros rejeitados:', deleteError);
      throw deleteError;
    }

    console.log(`✅ ${count || 0} registros rejeitados removidos com sucesso`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        registros_removidos: count || 0,
        mensagem: 'Registros rejeitados limpos com sucesso'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});