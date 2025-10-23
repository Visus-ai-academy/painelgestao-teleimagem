import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo } = await req.json();
    const periodoReferencia = periodo || '2025-09';

    console.log('🔧 Corrigindo nomes CEMVALENCA para período:', periodoReferencia);

    // Corrigir CEMVALENCA_PL -> CEMVALENCA_PLANTÃO
    const { error: error1 } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_PLANTÃO' })
      .eq('EMPRESA', 'CEMVALENCA_PL')
      .eq('periodo_referencia', periodoReferencia);

    if (error1) {
      console.error('❌ Erro ao corrigir CEMVALENCA_PL:', error1);
    } else {
      console.log('✅ Corrigido: CEMVALENCA_PL -> CEMVALENCA_PLANTÃO');
    }

    // Corrigir CEMVALENCA_RX -> P-CEMVALENCA_RX
    const { error: error2 } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'P-CEMVALENCA_RX' })
      .eq('EMPRESA', 'CEMVALENCA_RX')
      .eq('periodo_referencia', periodoReferencia);

    if (error2) {
      console.error('❌ Erro ao corrigir CEMVALENCA_RX:', error2);
    } else {
      console.log('✅ Corrigido: CEMVALENCA_RX -> P-CEMVALENCA_RX');
    }

    // Verificar resultado
    const { data: resultado } = await supabase
      .from('volumetria_mobilemed')
      .select('EMPRESA')
      .like('EMPRESA', '%CEMVALENCA%')
      .eq('periodo_referencia', periodoReferencia);

    const contagem = resultado?.reduce((acc: any, r: any) => {
      acc[r.EMPRESA] = (acc[r.EMPRESA] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Resultado final:', contagem);

    return new Response(JSON.stringify({
      success: true,
      periodo: periodoReferencia,
      contagem,
      mensagem: 'Nomes corrigidos com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
