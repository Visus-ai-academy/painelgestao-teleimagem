import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { periodo_referencia, clientes } = await req.json();

    console.log(`🔄 Resetando tipificação - Período: ${periodo_referencia}, Clientes: ${clientes.join(', ')}`);

    // Buscar registros dos clientes específicos
    let query = supabaseClient
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact' });

    if (periodo_referencia) {
      query = query.eq('periodo_referencia', periodo_referencia);
    }

    // Adicionar filtro OR para cada cliente
    const orConditions = clientes.map((cliente: string) => 
      `EMPRESA.ilike.%${cliente}%`
    ).join(',');
    
    query = query.or(orConditions);

    const { data: registros, error: selectError, count } = await query;

    if (selectError) {
      console.error('❌ Erro ao buscar registros:', selectError);
      throw selectError;
    }

    console.log(`📊 Encontrados ${count} registros para resetar`);

    if (!registros || registros.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        registros_resetados: 0,
        message: 'Nenhum registro encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Resetar tipificação em batches
    const BATCH_SIZE = 500;
    let totalResetados = 0;

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE);
      const ids = batch.map(r => r.id);

      const { error: updateError } = await supabaseClient
        .from('volumetria_mobilemed')
        .update({
          tipo_faturamento: null,
          tipo_cliente: null
        })
        .in('id', ids);

      if (updateError) {
        console.error(`❌ Erro ao resetar batch:`, updateError);
      } else {
        totalResetados += batch.length;
        console.log(`✅ Resetados ${totalResetados}/${count} registros`);
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      registros_resetados: totalResetados,
      clientes_processados: clientes,
      periodo_referencia
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro ao resetar tipificação:', error);

    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
