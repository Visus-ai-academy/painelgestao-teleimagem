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

    console.log('🧹 Iniciando remoção de duplicatas de preços...')

    // 1. Contar registros antes
    const { count: totalAntes, error: countError1 } = await supabaseClient
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true })

    if (countError1) {
      throw new Error(`Erro ao contar registros iniciais: ${countError1.message}`)
    }

    console.log(`📊 Total de registros antes da limpeza: ${totalAntes}`)

    // 2. Buscar grupos de duplicatas
    const { data: duplicatas, error: duplicatasError } = await supabaseClient
      .from('precos_servicos')
      .select(`
        cliente_id, modalidade, especialidade, prioridade, categoria,
        id, created_at, valor_base
      `)
      .order('cliente_id, modalidade, especialidade, prioridade, categoria, created_at')

    if (duplicatasError) {
      throw new Error(`Erro ao buscar duplicatas: ${duplicatasError.message}`)
    }

    console.log(`📋 Analisando ${duplicatas.length} registros...`)

    // 3. Identificar registros duplicados para remover
    const idsParaRemover = []
    const grupos = new Map()

    duplicatas.forEach(registro => {
      const chave = `${registro.cliente_id}-${registro.modalidade}-${registro.especialidade}-${registro.prioridade}-${registro.categoria}`
      
      if (grupos.has(chave)) {
        // Já existe um registro para esta combinação, marcar para remoção
        idsParaRemover.push(registro.id)
      } else {
        // Primeiro registro desta combinação, manter
        grupos.set(chave, registro)
      }
    })

    console.log(`🗑️ Identificados ${idsParaRemover.length} registros duplicados para remoção`)
    console.log(`✅ Mantendo ${grupos.size} registros únicos`)

    // 4. Remover duplicatas em lotes
    let removidos = 0
    const BATCH_SIZE = 100

    for (let i = 0; i < idsParaRemover.length; i += BATCH_SIZE) {
      const loteIds = idsParaRemover.slice(i, i + BATCH_SIZE)
      
      const { error: deleteError } = await supabaseClient
        .from('precos_servicos')
        .delete()
        .in('id', loteIds)

      if (deleteError) {
        console.error(`❌ Erro ao remover lote ${Math.floor(i/BATCH_SIZE) + 1}:`, deleteError)
      } else {
        removidos += loteIds.length
        console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} removido: ${loteIds.length} registros`)
      }
    }

    // 5. Contar registros após limpeza
    const { count: totalDepois, error: countError2 } = await supabaseClient
      .from('precos_servicos')
      .select('*', { count: 'exact', head: true })

    if (countError2) {
      console.error('❌ Erro ao contar registros finais:', countError2)
    }

    // 6. Estatísticas finais
    const { data: stats, error: statsError } = await supabaseClient
      .from('precos_servicos')
      .select('valor_base')
      .not('valor_base', 'is', null)

    let precos_positivos = 0
    let precos_zero = 0

    if (!statsError && stats) {
      stats.forEach(item => {
        if (item.valor_base > 0) {
          precos_positivos++
        } else {
          precos_zero++
        }
      })
    }

    console.log(`🎉 Limpeza concluída!`)
    console.log(`📊 Registros antes: ${totalAntes}`)
    console.log(`📊 Registros depois: ${totalDepois}`)
    console.log(`🗑️ Removidos: ${removidos}`)
    console.log(`💰 Preços positivos: ${precos_positivos}`)
    console.log(`0️⃣ Preços zero: ${precos_zero}`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_antes: totalAntes,
        registros_depois: totalDepois,
        duplicatas_removidas: removidos,
        precos_positivos: precos_positivos,
        precos_zero: precos_zero,
        combinacoes_unicas: grupos.size,
        mensagem: `Limpeza concluída: ${removidos} duplicatas removidas`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Erro na limpeza:', error.message)

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