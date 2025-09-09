import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { periodo_referencia = '2025-06', acao = 'verificar' } = await req.json()

    console.log('🔍 VERIFICANDO REGISTROS SEM DATA_LAUDO')
    console.log(`📅 Período: ${periodo_referencia}`)
    console.log(`⚙️ Ação: ${acao}`)

    // Buscar registros sem DATA_LAUDO
    const { data: registrosSemDataLaudo, error: errorSemLaudo } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        id,
        "EMPRESA",
        "NOME_PACIENTE", 
        "ESTUDO_DESCRICAO",
        "ACCESSION_NUMBER",
        "DATA_REALIZACAO",
        "DATA_LAUDO",
        "HORA_LAUDO",
        "DATA_PRAZO",
        "HORA_PRAZO",
        "MEDICO",
        "MODALIDADE",
        "ESPECIALIDADE",
        "PRIORIDADE",
        "CATEGORIA",
        "VALORES",
        arquivo_fonte,
        lote_upload,
        periodo_referencia,
        created_at
      `)
      .eq('periodo_referencia', periodo_referencia.replace('/', '/20'))
      .or('DATA_LAUDO.is.null,DATA_LAUDO.eq.')

    if (errorSemLaudo) {
      throw errorSemLaudo
    }

    console.log(`📊 Registros sem DATA_LAUDO encontrados: ${registrosSemDataLaudo?.length || 0}`)

    // Analisar os registros sem data_laudo
    const analise = {
      total_sem_data_laudo: registrosSemDataLaudo?.length || 0,
      por_arquivo_fonte: {} as Record<string, number>,
      por_cliente: {} as Record<string, number>,
      com_data_realizacao: 0,
      sem_data_realizacao: 0,
      com_accession_number: 0,
      sem_accession_number: 0,
      detalhes_amostra: [] as any[]
    }

    // Agrupar e analisar
    registrosSemDataLaudo?.forEach((registro, index) => {
      const arquivo = registro.arquivo_fonte || 'unknown'
      const cliente = registro.EMPRESA || 'unknown'

      analise.por_arquivo_fonte[arquivo] = (analise.por_arquivo_fonte[arquivo] || 0) + 1
      analise.por_cliente[cliente] = (analise.por_cliente[cliente] || 0) + 1

      if (registro.DATA_REALIZACAO) {
        analise.com_data_realizacao++
      } else {
        analise.sem_data_realizacao++
      }

      if (registro.ACCESSION_NUMBER) {
        analise.com_accession_number++
      } else {
        analise.sem_accession_number++
      }

      // Adicionar amostra dos primeiros 10 registros
      if (index < 10) {
        analise.detalhes_amostra.push({
          empresa: registro.EMPRESA,
          paciente: registro.NOME_PACIENTE,
          exame: registro.ESTUDO_DESCRICAO,
          accession: registro.ACCESSION_NUMBER,
          data_realizacao: registro.DATA_REALIZACAO,
          data_laudo: registro.DATA_LAUDO,
          medico: registro.MEDICO,
          arquivo_fonte: registro.arquivo_fonte,
          created_at: registro.created_at
        })
      }
    })

    // Verificar se existem outros registros do mesmo ACCESSION_NUMBER com data_laudo
    const registrosComAccession = registrosSemDataLaudo?.filter(r => r.ACCESSION_NUMBER) || []
    let registrosComParesSemLaudo = 0
    let registrosComParesComLaudo = 0

    if (registrosComAccession.length > 0) {
      console.log('🔍 Verificando se existem pares com DATA_LAUDO para os mesmos ACCESSION_NUMBER...')
      
      const accessionNumbers = registrosComAccession.map(r => r.ACCESSION_NUMBER)
      
      const { data: paresComLaudo } = await supabase
        .from('volumetria_mobilemed')
        .select('ACCESSION_NUMBER, DATA_LAUDO')
        .in('ACCESSION_NUMBER', accessionNumbers)
        .not('DATA_LAUDO', 'is', null)
        .not('DATA_LAUDO', 'eq', '')

      const accessionComLaudo = new Set(paresComLaudo?.map(p => p.ACCESSION_NUMBER) || [])
      
      registrosComAccession.forEach(registro => {
        if (accessionComLaudo.has(registro.ACCESSION_NUMBER)) {
          registrosComParesComLaudo++
        } else {
          registrosComParesSemLaudo++
        }
      })
    }

    // Buscar registros similares por paciente + exame + data_realizacao
    let registrosSimilaresComLaudo = 0
    if (registrosSemDataLaudo && registrosSemDataLaudo.length > 0) {
      console.log('🔍 Verificando registros similares por paciente + exame + data_realizacao...')
      
      for (const registro of registrosSemDataLaudo.slice(0, 50)) { // Limitar para evitar timeout
        if (registro.NOME_PACIENTE && registro.ESTUDO_DESCRICAO && registro.DATA_REALIZACAO) {
          const { data: similares } = await supabase
            .from('volumetria_mobilemed')
            .select('id')
            .eq('NOME_PACIENTE', registro.NOME_PACIENTE)
            .eq('ESTUDO_DESCRICAO', registro.ESTUDO_DESCRICAO)
            .eq('DATA_REALIZACAO', registro.DATA_REALIZACAO)
            .not('DATA_LAUDO', 'is', null)
            .not('DATA_LAUDO', 'eq', '')
            .limit(1)

          if (similares && similares.length > 0) {
            registrosSimilaresComLaudo++
          }
        }
      }
    }

    const resultado = {
      sucesso: true,
      periodo_referencia,
      analise: {
        ...analise,
        registros_com_pares_com_laudo: registrosComParesComLaudo,
        registros_com_pares_sem_laudo: registrosComParesSemLaudo,
        registros_similares_com_laudo: registrosSimilaresComLaudo
      },
      recomendacoes: [],
      timestamp: new Date().toISOString()
    }

    // Gerar recomendações
    if (analise.total_sem_data_laudo === 0) {
      resultado.recomendacoes.push('✅ Todos os registros possuem DATA_LAUDO. Nenhuma ação necessária.')
    } else {
      if (registrosComParesComLaudo > 0) {
        resultado.recomendacoes.push(`⚠️ ${registrosComParesComLaudo} registros têm pares com DATA_LAUDO. Podem ser duplicatas incompletas.`)
      }
      
      if (registrosSimilaresComLaudo > 0) {
        resultado.recomendacoes.push(`🔍 ${registrosSimilaresComLaudo} registros têm similares com DATA_LAUDO. Investigar inconsistências.`)
      }
      
      if (analise.sem_data_realizacao > 0) {
        resultado.recomendacoes.push(`❌ ${analise.sem_data_realizacao} registros sem DATA_REALIZACAO nem DATA_LAUDO. Recomenda-se exclusão.`)
      }
      
      if (analise.sem_accession_number > 0) {
        resultado.recomendacoes.push(`📋 ${analise.sem_accession_number} registros sem ACCESSION_NUMBER. Mais difíceis de rastrear.`)
      }

      // Recomendação de ação baseada na análise
      const porcentagemSemLaudo = (analise.total_sem_data_laudo / (analise.total_sem_data_laudo + 1000)) * 100 // Estimativa
      
      if (porcentagemSemLaudo > 10) {
        resultado.recomendacoes.push('🚨 ALTA porcentagem sem DATA_LAUDO. Verificar processo de importação.')
      } else if (porcentagemSemLaudo > 5) {
        resultado.recomendacoes.push('⚠️ MÉDIA porcentagem sem DATA_LAUDO. Monitorar situação.')
      } else {
        resultado.recomendacoes.push('✅ BAIXA porcentagem sem DATA_LAUDO. Situação normal.')
      }
    }

    // Se ação for 'excluir', executar a exclusão
    if (acao === 'excluir' && analise.total_sem_data_laudo > 0) {
      console.log('🗑️ EXECUTANDO EXCLUSÃO dos registros sem DATA_LAUDO...')
      
      const { error: errorExclusao } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .eq('periodo_referencia', periodo_referencia.replace('/', '/20'))
        .or('DATA_LAUDO.is.null,DATA_LAUDO.eq.')

      if (errorExclusao) {
        throw errorExclusao
      }

      resultado.recomendacoes.push(`✅ ${analise.total_sem_data_laudo} registros sem DATA_LAUDO foram excluídos.`)
      
      // Log da exclusão
      console.log(`✅ Excluídos ${analise.total_sem_data_laudo} registros sem DATA_LAUDO`)
    }

    console.log('📊 RESULTADO FINAL:')
    console.log(`   Total sem data_laudo: ${analise.total_sem_data_laudo}`)
    console.log(`   Com pares válidos: ${registrosComParesComLaudo}`)
    console.log(`   Similares com laudo: ${registrosSimilaresComLaudo}`)
    console.log(`   Recomendações: ${resultado.recomendacoes.length}`)

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Erro:', error)
    return new Response(JSON.stringify({ 
      sucesso: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})