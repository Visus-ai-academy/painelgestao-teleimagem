import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`🧹 Iniciando limpeza de tipo_faturamento incorreto na volumetria`)

    // Contar registros antes da limpeza
    const { count: totalAntes } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('tipo_faturamento', ['alta_complexidade', 'padrao', 'oncologia', 'urgencia'])

    console.log(`📊 Encontrados ${totalAntes} registros com tipo_faturamento incorreto`)

    if (!totalAntes || totalAntes === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: true, 
          mensagem: 'Nenhum registro para limpar',
          registrosLimpos: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Limpar tipo_faturamento incorreto - definir como NULL
    // O tipo_faturamento correto virá do contrato do cliente
    const { error: updateError } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        tipo_faturamento: null,
        updated_at: new Date().toISOString()
      })
      .in('tipo_faturamento', ['alta_complexidade', 'padrao', 'oncologia', 'urgencia'])

    if (updateError) {
      console.error('❌ Erro ao limpar tipo_faturamento:', updateError)
      throw updateError
    }

    console.log(`✅ ${totalAntes} registros limpos com sucesso`)

    // Verificar registros após limpeza
    const { count: totalDepois } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('tipo_faturamento', ['alta_complexidade', 'padrao', 'oncologia', 'urgencia'])

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        mensagem: 'Limpeza concluída com sucesso',
        registrosLimpos: totalAntes,
        registrosRestantes: totalDepois || 0,
        detalhes: {
          antes: totalAntes,
          depois: totalDepois || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na limpeza:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
