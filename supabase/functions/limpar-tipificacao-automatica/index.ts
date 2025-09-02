import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🧹 Iniciando limpeza da tipificação automática incorreta...')

    // Limpar tipificação automática dos registros recentes
    const { data: updateResult, error: updateError } = await supabaseClient
      .from('volumetria_mobilemed')
      .update({ 
        tipo_faturamento: null,
        updated_at: new Date().toISOString()
      })
      .in('tipo_faturamento', ['alta_complexidade', 'padrao', 'oncologia', 'urgencia'])
      .gte('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // últimas 3 horas

    if (updateError) {
      console.error('❌ Erro ao limpar tipificação:', updateError)
      throw updateError
    }

    console.log(`✅ Tipificação automática removida de ${updateResult?.length || 0} registros`)

    const resultado = {
      sucesso: true,
      registros_limpos: updateResult?.length || 0,
      message: 'Tipificação automática removida com sucesso',
      data_processamento: new Date().toISOString()
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ Erro na limpeza:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      erro: error.message,
      data_processamento: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})