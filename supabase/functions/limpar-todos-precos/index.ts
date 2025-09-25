import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

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
      console.error('❌ Erro ao contar registros:', countError)
      throw new Error(`Erro ao contar registros: ${countError.message}`)
    }

    console.log(`📊 Total de registros antes da limpeza: ${totalAntes}`)

    if (!totalAntes || totalAntes === 0) {
      console.log('✅ Banco já está limpo')
      return new Response(
        JSON.stringify({
          success: true,
          registros_antes: 0,
          registros_depois: 0,
          total_removido: 0,
          mensagem: 'Banco já estava limpo'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // 2. Deletar TODOS os registros em lotes grandes para máxima eficiência
    console.log('🗑️ Iniciando deleção otimizada em lotes...')
    let totalRemovido = 0
    const BATCH_SIZE = 10000 // Lotes maiores para ser mais rápido

    // Deletar sem consultar IDs primeiro - mais eficiente
    while (totalRemovido < totalAntes) {
      const { error: deleteError, count } = await supabaseClient
        .from('precos_servicos')
        .delete({ count: 'exact' })
        .lte('created_at', new Date().toISOString()) // Pega qualquer registro

      if (deleteError) {
        console.error('❌ Erro ao deletar:', deleteError)
        // Se der erro, tenta com lote menor
        const { error: deleteError2, count: count2 } = await supabaseClient
          .from('precos_servicos')
          .delete({ count: 'exact' })
          .limit(1000)

        if (deleteError2) {
          throw new Error(`Erro ao deletar: ${deleteError2.message}`)
        }

        if (!count2 || count2 === 0) break
        totalRemovido += count2
        continue
      }

      if (!count || count === 0) {
        console.log('✅ Não há mais registros para remover')
        break
      }

      totalRemovido += count
      console.log(`✅ Lote removido: ${count} registros (Total: ${totalRemovido})`)
      
      // Se removeu menos que o batch size, provavelmente acabou
      if (count < BATCH_SIZE) break
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
    console.log(`📊 Registros depois: ${totalDepois || 0}`)
    console.log(`🗑️ Total removido: ${totalRemovido}`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_antes: totalAntes,
        registros_depois: totalDepois || 0,
        total_removido: totalRemovido,
        mensagem: `Limpeza completa concluída: ${totalRemovido} registros foram removidos`
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