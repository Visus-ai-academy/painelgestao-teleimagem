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

  console.log('[limpar-faturamento-periodo] INÍCIO DA FUNÇÃO');
  
  try {
    const { periodo_referencia } = await req.json();
    console.log('[limpar-faturamento-periodo] Período recebido:', periodo_referencia);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se deve limpar TODOS os dados ou apenas um período específico
    let deleteQuery;
    
    if (periodo_referencia === 'all') {
      console.log('[limpar-faturamento-periodo] Limpando TODOS os dados de faturamento...');
      // Limpar TODOS os dados de faturamento
      deleteQuery = supabase.from('faturamento').delete().gte('id', '00000000-0000-0000-0000-000000000000');
    } else {
      console.log('[limpar-faturamento-periodo] Limpando dados do período:', periodo_referencia);
      // Limpar apenas dados do período específico E registros sem período (NULL)
      deleteQuery = supabase.from('faturamento').delete().or(`periodo_referencia.eq.${periodo_referencia},periodo_referencia.is.null`);
    }

    const { error: deleteError, count } = await deleteQuery;

    if (deleteError) {
      console.error('[limpar-faturamento-periodo] Erro ao limpar:', deleteError);
      throw deleteError;
    }

    console.log(`[limpar-faturamento-periodo] ${count || 0} registros removidos`);

    // Log adicional para confirmar limpeza
    const { count: verificacaoCount, error: errVerif } = await supabase
      .from('faturamento')
      .select('*', { count: 'exact', head: true });
    
    console.log(`[limpar-faturamento-periodo] Verificação pós-limpeza: ${verificacaoCount || 0} registros restantes`);

    return new Response(JSON.stringify({
      success: true,
      periodo_referencia,
      registros_removidos: count || 0,
      message: `Dados de faturamento do período ${periodo_referencia} foram limpos`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[limpar-faturamento-periodo] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});