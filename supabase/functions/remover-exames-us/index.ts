import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🗑️ Iniciando remoção de exames com modalidade US...');

    // Buscar exames US antes de remover para log
    const { data: examesUS, error: errorBusca } = await supabase
      .from('volumetria_mobilemed')
      .select('id, EMPRESA, NOME_PACIENTE, MODALIDADE')
      .eq('MODALIDADE', 'US');

    if (errorBusca) {
      throw new Error(`Erro ao buscar exames US: ${errorBusca.message}`);
    }

    const totalEncontrados = examesUS?.length || 0;
    console.log(`📊 Encontrados ${totalEncontrados} exames com modalidade US`);

    if (totalEncontrados === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Nenhum exame com modalidade US encontrado',
        total_removidos: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Remover exames US
    const { error: errorDelete } = await supabase
      .from('volumetria_mobilemed')
      .delete()
      .eq('MODALIDADE', 'US');

    if (errorDelete) {
      throw new Error(`Erro ao remover exames US: ${errorDelete.message}`);
    }

    console.log(`✅ ${totalEncontrados} exames com modalidade US removidos com sucesso`);

    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: `${totalEncontrados} exames com modalidade US removidos com sucesso`,
      total_removidos: totalEncontrados,
      detalhes: examesUS
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro ao remover exames US:', error);
    
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
