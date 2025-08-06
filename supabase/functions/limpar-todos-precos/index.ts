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

    // 2. Deletar TODOS os registros em lotes para evitar timeout
    console.log('🗑️ Iniciando deleção em lotes...')
    let totalRemovido = 0
    const BATCH_SIZE = 1000

    // Continuar deletando até não haver mais registros
    while (true) {
      const { data: registrosParaRemover, error: selectError } = await supabaseClient
        .from('precos_servicos')
        .select('id')
        .limit(BATCH_SIZE)

      if (selectError) {
        console.error('❌ Erro ao buscar registros:', selectError)
        break
      }

      if (!registrosParaRemover || registrosParaRemover.length === 0) {
        console.log('✅ Não há mais registros para remover')
        break
      }

      const ids = registrosParaRemover.map(r => r.id)
      const { error: deleteError, count } = await supabaseClient
        .from('precos_servicos')
        .delete({ count: 'exact' })
        .in('id', ids)

      if (deleteError) {
        console.error('❌ Erro ao deletar lote:', deleteError)
        throw new Error(`Erro ao deletar lote: ${deleteError.message}`)
      }

      totalRemovido += count || ids.length
      console.log(`✅ Lote removido: ${count || ids.length} registros (Total: ${totalRemovido})`)
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