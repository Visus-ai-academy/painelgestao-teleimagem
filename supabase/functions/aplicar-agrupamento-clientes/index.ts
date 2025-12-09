import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Iniciando aplicação de agrupamento de clientes...')

    // Detectar dinamicamente a coluna de prioridade (PRIORIDADE vs prioridade)
    let prioridadeCol = 'PRIORIDADE'
    try {
      const { error: prioridadeProbeError } = await supabase
        .from('volumetria_mobilemed')
        .select('PRIORIDADE', { head: true, count: 'exact' })
        .limit(0)
      if (prioridadeProbeError) {
        prioridadeCol = 'prioridade'
      }
    } catch (_) {
      prioridadeCol = 'prioridade'
    }
    console.log(`🔎 Coluna de prioridade detectada: ${prioridadeCol}`)

    // 1. Aplicar mapeamento de nome_mobilemed para nome_fantasia
    console.log('📋 Buscando mapeamento de clientes...')
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('nome_mobilemed, nome_fantasia')
      .not('nome_mobilemed', 'is', null)
      .not('nome_fantasia', 'is', null)

    if (errorClientes) {
      console.error('❌ Erro ao buscar clientes:', errorClientes)
      throw errorClientes
    }

    console.log(`📋 Carregados ${clientes?.length || 0} mapeamentos de clientes`)

    // Criar mapa para lookup rápido
    const mapeamentoClientes: Record<string, string> = {}
    clientes?.forEach(cliente => {
      if (cliente.nome_mobilemed && cliente.nome_fantasia) {
        mapeamentoClientes[cliente.nome_mobilemed] = cliente.nome_fantasia
      }
    })

    // Aplicar mapeamento para cada cliente encontrado
    let totalMapeados = 0
    for (const [nomeMobilemed, nomeFantasia] of Object.entries(mapeamentoClientes)) {
      const { data: dadosMapeados, error: errorMapeamento } = await supabase
        .from('volumetria_mobilemed')
        .update({ EMPRESA: nomeFantasia })
        .eq('EMPRESA', nomeMobilemed)
        .select('id')
      
      if (!errorMapeamento && dadosMapeados) {
        totalMapeados += dadosMapeados.length
        if (dadosMapeados.length > 0) {
          console.log(`✅ Mapeado "${nomeMobilemed}" → "${nomeFantasia}": ${dadosMapeados.length} registros`)
        }
      }
    }

    console.log(`✅ Total de registros mapeados: ${totalMapeados}`)

    // 2. Agrupar DIAGNOSTICA PLANTAO_* como DIAGNOSTICA
    const { data: diagnosticaData, error: diagnosticaError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'DIAGNOSTICA' })
      .ilike('EMPRESA', 'DIAGNOSTICA PLANTAO_%')
      .select('id')

    if (diagnosticaError) {
      console.error('❌ Erro ao agrupar DIAGNOSTICA:', diagnosticaError)
      throw diagnosticaError
    }

    console.log(`✅ Agrupados ${diagnosticaData?.length || 0} registros de DIAGNOSTICA PLANTAO_* para DIAGNOSTICA`)

    // ========================================
    // REGRAS CEMVALENCA - ORDEM IMPORTANTE:
    // 1. RX ou DX → CEMVALENCA_RX (independente de prioridade)
    // 2. PLANTÃO (não RX/DX) → CEMVALENCA_PL
    // 3. Demais → CEMVALENCA
    // ========================================

    // 3. Mover exames RX de CEMVALENCA para CEMVALENCA_RX
    const { data: cemvalencaRxData, error: cemvalencaRxError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_RX' })
      .eq('EMPRESA', 'CEMVALENCA')
      .eq('MODALIDADE', 'RX')
      .select('id')

    if (cemvalencaRxError) {
      console.error('❌ Erro ao processar CEMVALENCA_RX (RX):', cemvalencaRxError)
      throw cemvalencaRxError
    }

    console.log(`✅ Movidos ${cemvalencaRxData?.length || 0} registros RX para CEMVALENCA_RX`)

    // 4. Mover exames DX de CEMVALENCA para CEMVALENCA_RX
    const { data: cemvalencaDxData, error: cemvalencaDxError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_RX' })
      .eq('EMPRESA', 'CEMVALENCA')
      .eq('MODALIDADE', 'DX')
      .select('id')

    if (cemvalencaDxError) {
      console.error('❌ Erro ao processar CEMVALENCA_RX (DX):', cemvalencaDxError)
      throw cemvalencaDxError
    }

    console.log(`✅ Movidos ${cemvalencaDxData?.length || 0} registros DX para CEMVALENCA_RX`)

    // 5. Mover exames com prioridade PLANTÃO de CEMVALENCA para CEMVALENCA_PL
    // (RX/DX já foram movidos, então aqui só pega outros exames com PLANTÃO)
    const { data: cemvalencaPlData, error: cemvalencaPlError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_PL' })
      .eq('EMPRESA', 'CEMVALENCA')
      .ilike(prioridadeCol, '%PLANT%')
      .select('id')

    if (cemvalencaPlError) {
      console.error('❌ Erro ao processar CEMVALENCA_PL:', cemvalencaPlError)
      throw cemvalencaPlError
    }

    console.log(`✅ Movidos ${cemvalencaPlData?.length || 0} registros PLANTÃO para CEMVALENCA_PL`)

    // 6. Correção: Retornar registros de CEMVALENCA_PL que não são PLANTÃO para CEMVALENCA
    const { data: cemvalencaPlRetData, error: cemvalencaPlRetError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA' })
      .eq('EMPRESA', 'CEMVALENCA_PL')
      .not(prioridadeCol, 'ilike', '%PLANT%')
      .select('id')

    if (cemvalencaPlRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_PL:', cemvalencaPlRetError)
      throw cemvalencaPlRetError
    }

    console.log(`✅ Retornados ${cemvalencaPlRetData?.length || 0} registros de CEMVALENCA_PL → CEMVALENCA (sem PLANTÃO)`)

    // 7. Correção: Retornar registros de CEMVALENCA_RX que não são RX nem DX para CEMVALENCA
    const { data: cemvalencaRxRetData, error: cemvalencaRxRetError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA' })
      .eq('EMPRESA', 'CEMVALENCA_RX')
      .neq('MODALIDADE', 'RX')
      .neq('MODALIDADE', 'DX')
      .select('id')

    if (cemvalencaRxRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_RX:', cemvalencaRxRetError)
      throw cemvalencaRxRetError
    }

    console.log(`✅ Retornados ${cemvalencaRxRetData?.length || 0} registros de CEMVALENCA_RX → CEMVALENCA (sem RX/DX)`)

    // 8. Verificar contagem final
    const { count: cemvalencaCount } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('EMPRESA', 'CEMVALENCA')

    const { count: cemvalencaRxCount } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('EMPRESA', 'CEMVALENCA_RX')

    const { count: cemvalencaPlCount } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('EMPRESA', 'CEMVALENCA_PL')

    console.log(`📊 Contagem final:`)
    console.log(`   - CEMVALENCA: ${cemvalencaCount || 0}`)
    console.log(`   - CEMVALENCA_RX: ${cemvalencaRxCount || 0}`)
    console.log(`   - CEMVALENCA_PL: ${cemvalencaPlCount || 0}`)

    const resultado = {
      success: true,
      total_mapeados: totalMapeados,
      diagnostica_agrupados: diagnosticaData?.length || 0,
      cemvalenca_rx_movidos: (cemvalencaRxData?.length || 0) + (cemvalencaDxData?.length || 0),
      cemvalenca_pl_movidos: cemvalencaPlData?.length || 0,
      cemvalenca_pl_retorno: cemvalencaPlRetData?.length || 0,
      cemvalenca_rx_retorno: cemvalencaRxRetData?.length || 0,
      contagem_final: {
        cemvalenca: cemvalencaCount || 0,
        cemvalenca_rx: cemvalencaRxCount || 0,
        cemvalenca_pl: cemvalencaPlCount || 0
      },
      mensagem: 'Agrupamento de clientes aplicado com sucesso'
    }

    console.log('✅ Resultado final:', resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ Erro ao aplicar agrupamento:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Erro ao aplicar agrupamento de clientes'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
