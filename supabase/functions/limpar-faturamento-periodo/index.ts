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

    // Limpar dados de faturamento do período específico
    const { error: deleteError, count } = await supabase
      .from('faturamento')
      .delete()
      .eq('periodo_referencia', periodo_referencia);

    if (deleteError) {
      console.error('[limpar-faturamento-periodo] Erro ao limpar:', deleteError);
      throw deleteError;
    }

    console.log(`[limpar-faturamento-periodo] ${count || 0} registros removidos`);

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