import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('Nenhum arquivo foi enviado')
    }

    console.log(`📁 Processando arquivo: ${file.name}`)
    console.log(`📊 Tamanho: ${file.size} bytes`)

    // 1. Limpar uploads antigos travados
    await supabaseClient
      .from('upload_logs')
      .delete()
      .eq('file_type', 'precos_servicos')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Mais de 5 minutos

    // 2. Criar log de processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: file.name,
        file_type: 'precos_servicos',
        status: 'processing',
        file_size: file.size,
        uploader: 'authenticated_user'
      })
      .select()
      .single()

    if (logError) {
      console.error('❌ Erro ao criar log:', logError)
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    console.log(`✅ Log criado: ${logEntry.id}`)

    // 2. Processar arquivo Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
    
    console.log(`📋 Total de linhas no Excel: ${jsonData.length}`)
    console.log(`🏷️ Headers: ${JSON.stringify(jsonData[0])}`)

    // 3. Buscar todos os clientes uma vez para melhor performance
    const { data: clientesData, error: clientesError } = await supabaseClient
      .from('clientes')
      .select('id, nome')
      .eq('ativo', true)

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`)
    }

    // Criar mapa de clientes para busca rápida
    const clientesMap = new Map()
    clientesData.forEach(cliente => {
      clientesMap.set(cliente.nome.toUpperCase().trim(), cliente.id)
    })

    console.log(`📋 ${clientesData.length} clientes carregados`)

    // 4. Processar dados do Excel
    const registrosParaInserir = []
    const erros = []
    let registrosProcessados = 0

    for (let i = 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row || row.length < 6) {
          erros.push(`Linha ${i + 1}: dados insuficientes - ${row ? row.length : 0} colunas`)
          continue
        }

        // Mapear campos do Excel baseado no template correto
        // ["CLIENTE","DT INÍCIO VIGÊNCIA","DT FIM VIGÊNCIA","MODALIDADE","ESPECIALIDADE","PRIORIDADE","CATEGORIA","PREÇO","VOL INICIAL","VOL FINAL","COND. VOLUME","CONSIDERA PLANTAO","TEM ADITIVO"]
        const clienteNome = String(row[0] || '').trim()
        const dataInicio = String(row[1] || '').trim() // DT INÍCIO VIGÊNCIA
        const dataFim = String(row[2] || '').trim() // DT FIM VIGÊNCIA  
        const modalidade = String(row[3] || '').trim() 
        const especialidade = String(row[4] || '').trim()
        const prioridade = String(row[5] || '').trim()
        const categoria = String(row[6] || '').trim()
        const precoStr = String(row[7] || '').trim()
        const volInicial = row[8] ? parseInt(String(row[8])) || null : null
        const volFinal = row[9] ? parseInt(String(row[9])) || null : null
        const condVolume = row[10] ? parseInt(String(row[10])) || null : null
        const consideraPlantao = String(row[11] || '').toLowerCase() === 'sim'

        // Validar dados obrigatórios
        if (!clienteNome || clienteNome.length < 2) {
          erros.push(`Linha ${i + 1}: Cliente inválido - "${clienteNome}"`)
          continue
        }

        if (!modalidade) {
          erros.push(`Linha ${i + 1}: Modalidade inválida - "${modalidade}"`)
          continue
        }

        if (!especialidade) {
          erros.push(`Linha ${i + 1}: Especialidade inválida - "${especialidade}"`)
          continue
        }

        // Buscar cliente
        const clienteId = clientesMap.get(clienteNome.toUpperCase())
        if (!clienteId) {
          erros.push(`Linha ${i + 1}: Cliente "${clienteNome}" não encontrado no cadastro`)
          continue
        }

        // Limpar e converter preço
        let preco = 0
        if (precoStr) {
          const precoLimpo = precoStr.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
          const precoConvertido = precoLimpo.includes(',') && !precoLimpo.includes('.') ? 
            precoLimpo.replace(',', '.') : precoLimpo
          preco = parseFloat(precoConvertido) || 0
        }

        // Aceitar tanto preços zerados quanto não-zerados
        // Apenas validar se não é um valor inválido/NaN
        if (isNaN(preco)) {
          erros.push(`Linha ${i + 1}: Preço com formato inválido - "${precoStr}"`)
          continue
        }

        // Preparar registro para inserção
        registrosParaInserir.push({
          cliente_id: clienteId,
          modalidade: modalidade,
          especialidade: especialidade,
          categoria: categoria || 'Normal',
          prioridade: prioridade || 'Rotina',
          valor_base: preco,
          valor_urgencia: preco, // Por enquanto igual ao valor_base
          volume_inicial: volInicial,
          volume_final: volFinal,
          volume_total: condVolume,
          considera_prioridade_plantao: consideraPlantao,
          tipo_preco: 'especial',
          aplicar_legado: true,
          aplicar_incremental: true,
          ativo: true
        })

        registrosProcessados++

      } catch (error) {
        erros.push(`Linha ${i + 1}: ${error.message}`)
      }
    }

    console.log(`📊 Registros preparados: ${registrosParaInserir.length}`)
    console.log(`❌ Erros de validação: ${erros.length}`)

    // 5. Inserir registros no banco em lotes
    let registrosInseridos = 0
    let registrosComErro = 0
    const BATCH_SIZE = 50

    for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
      const lote = registrosParaInserir.slice(i, i + BATCH_SIZE)
      
      try {
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .insert(lote)

        if (insertError) {
          console.error(`❌ Erro ao inserir lote ${Math.floor(i/BATCH_SIZE) + 1}:`, insertError)
          registrosComErro += lote.length
        } else {
          registrosInseridos += lote.length
          console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} inserido: ${lote.length} registros`)
        }
      } catch (error) {
        console.error(`❌ Erro no lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error)
        registrosComErro += lote.length
      }
    }

    // 6. Sincronizar preços com contratos
    try {
      console.log('🔄 Sincronizando preços com contratos...')
      await supabaseClient.rpc('sincronizar_precos_servicos_contratos')
      console.log('✅ Preços sincronizados com contratos')
      
      console.log('🔄 Atualizando status dos contratos...')
      await supabaseClient.rpc('atualizar_status_configuracao_contrato')
      console.log('✅ Status dos contratos atualizados')
    } catch (error) {
      console.error('❌ Erro ao sincronizar preços com contratos:', error.message)
    }

    // 7. Finalizar log
    const status = registrosInseridos > 0 ? 'success' : 'failed'
    const errorDetails = erros.length > 0 ? erros.slice(0, 10).join('; ') : null

    await supabaseClient
      .from('upload_logs')
      .update({
        status: status,
        records_processed: registrosInseridos,
        error_count: erros.length + registrosComErro,
        error_message: errorDetails
      })
      .eq('id', logEntry.id)

    console.log(`🎉 Processamento concluído: ${registrosInseridos} sucessos, ${erros.length + registrosComErro} erros`)

    // 8. Retornar resposta
    return new Response(
      JSON.stringify({
        success: registrosInseridos > 0,
        registros_processados: registrosInseridos,
        registros_erro: erros.length + registrosComErro,
        total_linhas: jsonData.length - 1,
        mensagem: `Processamento concluído. ${registrosInseridos} preços inseridos com sucesso. ${erros.length + registrosComErro} erros encontrados.`,
        detalhes_erros: erros.slice(0, 5) // Primeiros 5 erros para debugging
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Erro geral:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor',
        registros_processados: 0,
        registros_erro: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})