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

    // 1. Agrupar DIAGNOSTICA PLANTAO_* como DIAGNOSTICA
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

    // 2. Garantir que CEMVALENCA RX com prioridade PLANTÃO vá para CEMVALENCA_RX
    const { data: cemvalencaRxData, error: cemvalencaRxError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_RX' })
      .eq('EMPRESA', 'CEMVALENCA')
      .eq('MODALIDADE', 'RX')
      .or('PRIORIDADE.ilike.%PLANTÃO%,PRIORIDADE.ilike.%PLANTAO%')
      .select('id')

    if (cemvalencaRxError) {
      console.error('❌ Erro ao processar CEMVALENCA_RX:', cemvalencaRxError)
      throw cemvalencaRxError
    }

    console.log(`✅ Movidos ${cemvalencaRxData?.length || 0} registros RX PLANTÃO para CEMVALENCA_RX`)

    // 3. Garantir que CEMVALENCA não-RX com prioridade PLANTÃO vá para CEMVALENCA_PL
    const { data: cemvalencaPlData, error: cemvalencaPlError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA_PL' })
      .eq('EMPRESA', 'CEMVALENCA')
      .neq('MODALIDADE', 'RX')
      .or('PRIORIDADE.ilike.%PLANTÃO%,PRIORIDADE.ilike.%PLANTAO%')
      .select('id')

    if (cemvalencaPlError) {
      console.error('❌ Erro ao processar CEMVALENCA_PL:', cemvalencaPlError)
      throw cemvalencaPlError
    }

    console.log(`✅ Movidos ${cemvalencaPlData?.length || 0} registros não-RX PLANTÃO para CEMVALENCA_PL`)

    // 3.1: Retornar registros indevidos (sem PLANTÃO) de CEMVALENCA_PL para CEMVALENCA
    const { data: cemvalencaPlRetData, error: cemvalencaPlRetError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA' })
      .eq('EMPRESA', 'CEMVALENCA_PL')
      .not('PRIORIDADE', 'ilike', '%PLANTÃO%')
      .not('PRIORIDADE', 'ilike', '%PLANTAO%')
      .select('id')

    if (cemvalencaPlRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_PL:', cemvalencaPlRetError)
      throw cemvalencaPlRetError
    }

    console.log(`✅ Retornados ${cemvalencaPlRetData?.length || 0} registros de CEMVALENCA_PL → CEMVALENCA (sem PLANTÃO) `)

    // 3.2: Retornar registros indevidos (sem PLANTÃO) de CEMVALENCA_RX para CEMVALENCA
    const { data: cemvalencaRxRetData, error: cemvalencaRxRetError } = await supabase
      .from('volumetria_mobilemed')
      .update({ EMPRESA: 'CEMVALENCA' })
      .eq('EMPRESA', 'CEMVALENCA_RX')
      .not('PRIORIDADE', 'ilike', '%PLANTÃO%')
      .not('PRIORIDADE', 'ilike', '%PLANTAO%')
      .select('id')

    if (cemvalencaRxRetError) {
      console.error('❌ Erro ao retornar indevidos de CEMVALENCA_RX:', cemvalencaRxRetError)
      throw cemvalencaRxRetError
    }

    console.log(`✅ Retornados ${cemvalencaRxRetData?.length || 0} registros de CEMVALENCA_RX → CEMVALENCA (sem PLANTÃO) `)

    // 4. Verificar quantos registros CEMVALENCA restaram
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
