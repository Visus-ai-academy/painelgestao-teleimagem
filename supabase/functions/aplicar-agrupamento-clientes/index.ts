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

    // 0. Preservar nome original em unidade_origem antes de aplicar mapeamentos
    // Observação: copiar valor de outra coluna direto no update não é suportado pelo supabase-js sem SQL bruto.
    // Para evitar erro e manter o processo simples, vamos pular esta etapa aqui.
    console.log('ℹ️ Pulando preservação automática de unidade_origem (sem SQL/raw). Prosseguindo com mapeamentos...')

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

    // 3. Garantir que CEMVALENCA RX com prioridade PLANTÃO vá para CEMVALENCA_RX
    let cemvalencaRxData: any[] | null = null
    let cemvalencaRxError: any = null
      let rxResp = await supabase
        .from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_RX' })
        .eq('EMPRESA', 'CEMVALENCA')
        .eq('MODALIDADE', 'RX')
        .ilike(prioridadeCol, '%PLANT%')
        .select('id')

    cemvalencaRxData = rxResp.data
    cemvalencaRxError = rxResp.error

    if (cemvalencaRxError) {
      console.error('❌ Erro ao processar CEMVALENCA_RX:', cemvalencaRxError)
      throw cemvalencaRxError
    }

    console.log(`✅ Movidos ${cemvalencaRxData?.length || 0} registros RX PLANTÃO para CEMVALENCA_RX`)

    // 4. Garantir que CEMVALENCA não-RX com prioridade PLANTÃO vá para CEMVALENCA_PL
    let cemvalencaPlData: any[] | null = null
    let cemvalencaPlError: any = null
      let plResp = await supabase
        .from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA_PL' })
        .eq('EMPRESA', 'CEMVALENCA')
        .neq('MODALIDADE', 'RX')
        .ilike(prioridadeCol, '%PLANT%')
        .select('id')

    cemvalencaPlData = plResp.data
    cemvalencaPlError = plResp.error

    if (cemvalencaPlError) {
      console.error('❌ Erro ao processar CEMVALENCA_PL:', cemvalencaPlError)
      throw cemvalencaPlError
    }

    console.log(`✅ Movidos ${cemvalencaPlData?.length || 0} registros não-RX PLANTÃO para CEMVALENCA_PL`)

    // 5. Retornar registros indevidos (sem PLANTÃO) de CEMVALENCA_PL para CEMVALENCA
    let cemvalencaPlRetData: any[] | null = null
    let cemvalencaPlRetError: any = null
      let plRetResp = await supabase
        .from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA' })
        .eq('EMPRESA', 'CEMVALENCA_PL')
        .not(prioridadeCol, 'ilike', '%PLANT%')
        .select('id')

    cemvalencaPlRetData = plRetResp.data
    cemvalencaPlRetError = plRetResp.error

    if (cemvalencaPlRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_PL:', cemvalencaPlRetError)
      throw cemvalencaPlRetError
    }

    console.log(`✅ Retornados ${cemvalencaPlRetData?.length || 0} registros de CEMVALENCA_PL → CEMVALENCA (sem PLANTÃO) `)

    // 6. Retornar registros indevidos (sem PLANTÃO) de CEMVALENCA_RX para CEMVALENCA
    let cemvalencaRxRetData: any[] | null = null
    let cemvalencaRxRetError: any = null
      let rxRetResp = await supabase
        .from('volumetria_mobilemed')
        .update({ EMPRESA: 'CEMVALENCA' })
        .eq('EMPRESA', 'CEMVALENCA_RX')
        .not(prioridadeCol, 'ilike', '%PLANT%')
        .select('id')

    cemvalencaRxRetData = rxRetResp.data
    cemvalencaRxRetError = rxRetResp.error

    if (cemvalencaRxRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_RX:', cemvalencaRxRetError)
      throw cemvalencaRxRetError
    }

    console.log(`✅ Retornados ${cemvalencaRxRetData?.length || 0} registros de CEMVALENCA_RX → CEMVALENCA (sem PLANTÃO) `)

    // 7. Verificar quantos registros CEMVALENCA restaram
    const { count: cemvalencaCount, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('EMPRESA', 'CEMVALENCA')

    if (countError) {
      console.error('❌ Erro ao contar CEMVALENCA:', countError)
    } else {
      console.log(`📊 Registros restantes em CEMVALENCA: ${cemvalencaCount || 0}`)
    }

    const resultado = {
      success: true,
      total_mapeados: totalMapeados,
      diagnostica_agrupados: diagnosticaData?.length || 0,
      cemvalenca_rx_movidos: cemvalencaRxData?.length || 0,
      cemvalenca_pl_movidos: cemvalencaPlData?.length || 0,
      cemvalenca_pl_retorno: cemvalencaPlRetData?.length || 0,
      cemvalenca_rx_retorno: cemvalencaRxRetData?.length || 0,
      cemvalenca_restantes: cemvalencaCount || 0,
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
