import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetNFRequest {
  periodo: string;
  clientes: string[]; // Array de nomes de clientes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo, clientes }: ResetNFRequest = await req.json();
    
    if (!periodo || !clientes || clientes.length === 0) {
      throw new Error('Período e clientes são obrigatórios');
    }

    console.log(`Resetando status NF Omie para período ${periodo} - clientes: ${clientes.join(', ')}`);

    // Resetar status das NFs do Omie para os clientes especificados
    const { data: resetData, error: resetError } = await supabase
      .from('relatorios_faturamento_status')
      .update({
        omie_nf_gerada: false,
        omie_codigo_pedido: null,
        omie_numero_pedido: null,
        data_geracao_nf_omie: null,
        omie_detalhes: null,
        erro: null,
        updated_at: new Date().toISOString()
      })
      .in('cliente_nome', clientes)
      .eq('periodo', periodo)
      .select('cliente_nome, omie_nf_gerada, updated_at');

    if (resetError) {
      throw new Error(`Erro ao resetar status: ${resetError.message}`);
    }

    console.log(`✅ Status resetado para ${resetData?.length || 0} registros`);

    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        clientes_resetados: clientes,
        registros_atualizados: resetData?.length || 0,
        detalhes: resetData,
        message: `Status das NFs resetado com sucesso para ${clientes.join(', ')}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na função resetar-status-nf-omie:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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