import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log('🧹 Iniciando limpeza completa de todos os preços...')

    // 1. Contar registros antes
    const { count: totalAntes, error: countError } = await supabaseClient
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw new Error(`Erro ao contar registros: ${countError.message}`)
    }

    console.log(`📊 Total de registros antes da limpeza: ${totalAntes}`)

    // 2. Deletar TODOS os registros
    const { error: deleteError } = await supabaseClient
      .from('precos_servicos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Condição que sempre será verdadeira

    if (deleteError) {
      throw new Error(`Erro ao deletar registros: ${deleteError.message}`)
    }

    // 3. Contar registros após limpeza (deve ser 0)
    const { count: totalDepois, error: countError2 } = await supabaseClient
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true })

    if (countError2) {
      console.error('❌ Erro ao contar registros finais:', countError2)
    }

    console.log(`🎉 Limpeza completa concluída!`)
    console.log(`📊 Registros antes: ${totalAntes}`)
    console.log(`📊 Registros depois: ${totalDepois}`)
    console.log(`🗑️ Total removido: ${totalAntes}`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_antes: totalAntes,
        registros_depois: totalDepois || 0,
        total_removido: totalAntes,
        mensagem: `Limpeza completa concluída: todos os ${totalAntes} registros foram removidos`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Erro na limpeza completa:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})