import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
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

    // 1.1. Replace strategy: a exclusão será feita por cliente após o parse do arquivo
    // (remoção global da tabela foi desativada)

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

    // 3.1. Buscar mapeamentos de nomes de clientes
    const { data: mapeamentosData, error: mapeamentosError } = await supabaseClient
      .from('mapeamento_nomes_clientes')
      .select('nome_arquivo, nome_sistema')
      .eq('ativo', true)

    if (mapeamentosError) {
      console.warn('⚠️ Erro ao buscar mapeamentos de nomes:', mapeamentosError.message)
    }

    // Criar mapa de mapeamentos
    const mapeamentosMap = new Map()
    if (mapeamentosData) {
      mapeamentosData.forEach(mapeamento => {
        mapeamentosMap.set(mapeamento.nome_arquivo.toUpperCase().trim(), mapeamento.nome_sistema.toUpperCase().trim())
      })
      console.log(`🔄 ${mapeamentosData.length} mapeamentos de nomes carregados`)
    }

    // 4. Processar dados do Excel
    const registrosParaInserir = []
    const erros = []
    let registrosProcessados = 0

    for (let i = 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row) {
          erros.push(`Linha ${i + 1}: linha vazia`)
        }

        // Mapear campos do Excel baseado no template correto
        // ["CLIENTE","MODALIDADE","ESPECIALIDADE","PRIORIDADE","CATEGORIA","PREÇO","VOL INICIAL","VOL FINAL","COND. VOLUME","CONSIDERA PLANTAO"]
        const clienteNome = String(row[0] || '').trim()
        const modalidade = String(row[1] || '').trim() 
        const especialidade = String(row[2] || '').trim()
        const prioridade = String(row[3] || '').trim()
        let categoria = String(row[4] || '').trim()
        const precoStr = String(row[5] || '').trim()
        const volInicial = row[6] ? parseInt(String(row[6])) || null : null
        const volFinal = row[7] ? parseInt(String(row[7])) || null : null
        const condVolume = row[8] ? parseInt(String(row[8])) || null : null
        const consideraPlantao = String(row[9] || '').toLowerCase() === 'sim'
        let observacoesRow = ''
        
        // Tratar categoria vazia ou "Normal" como "N/A"
        if (!categoria || categoria === 'Normal' || categoria === '') {
          categoria = 'N/A'
        }

        // Log para debug das primeiras linhas
        if (i <= 5) {
          console.log(`🔍 Linha ${i + 1}: Cliente="${clienteNome}", Modal="${modalidade}", Espec="${especialidade}", Prior="${prioridade}", Preço="${precoStr}"`)
        }

        // Validar campos obrigatórios (não podem estar vazios)
        if (!clienteNome || clienteNome.length < 2) {
          erros.push(`Linha ${i + 1}: Cliente obrigatório inválido - "${clienteNome}"`)
          continue
        }

        // Aceitar modalidade vazia
        const modalidadeFinal = modalidade || 'N/A'

        // Aceitar especialidade vazia  
        const especialidadeFinal = especialidade || 'N/A'

        // Aceitar prioridade vazia
        const prioridadeFinal = prioridade || 'N/A'

        // Aceitar preços vazios (serão tratados como 0)

        // Buscar cliente (com mapeamento de nomes)
        let clienteNomeBusca = clienteNome.toUpperCase()
        
        // Verificar se existe mapeamento para o nome
        const nomeMapeado = mapeamentosMap.get(clienteNomeBusca)
        if (nomeMapeado) {
          clienteNomeBusca = nomeMapeado
          console.log(`🔄 Mapeamento aplicado: "${clienteNome}" → "${nomeMapeado}"`)
        }
        
        const clienteId = clientesMap.get(clienteNomeBusca)
        if (!clienteId) {
          observacoesRow += `Cliente não localizado: ${clienteNome}. `
        }

        // Limpar e converter preço
        let preco = 0
        if (precoStr) {
          const precoLimpo = precoStr.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
          const precoConvertido = precoLimpo.includes(',') && !precoLimpo.includes('.') ? 
            precoLimpo.replace(',', '.') : precoLimpo
          preco = parseFloat(precoConvertido) || 0
        }

        // Arredondar para 2 casas decimais (garantir 2 casas)
        preco = Math.round(preco * 100) / 100

        // Preparar registro para inserção
        registrosParaInserir.push({
          cliente_id: clienteId || null,
          modalidade: modalidadeFinal,
          especialidade: especialidadeFinal,
          categoria: categoria,
          prioridade: prioridadeFinal,
          valor_base: preco,
          valor_urgencia: preco, // Por enquanto igual ao valor_base
          volume_inicial: volInicial,
          volume_final: volFinal,
          volume_total: condVolume,
          considera_prioridade_plantao: consideraPlantao,
          tipo_preco: 'especial',
          aplicar_legado: true,
          aplicar_incremental: true,
          ativo: true,
          observacoes: observacoesRow || null,
          descricao: clienteId ? null : `Cliente original: ${clienteNome}`
        })

        registrosProcessados++

      } catch (error) {
        erros.push(`Linha ${i + 1}: ${error.message}`)
      }
    }

    console.log(`📊 Registros preparados: ${registrosParaInserir.length}`)
    console.log(`❌ Erros de validação: ${erros.length}`)

    // 4.1. Replace por cliente: apagar preços existentes apenas dos clientes presentes no arquivo
    const clienteIdsAlvo = Array.from(new Set(registrosParaInserir.map((r: any) => r.cliente_id).filter((id: string | null): id is string => !!id)))
    console.log(`🧹 Clientes alvo para replace: ${clienteIdsAlvo.length}`)
    const DELETE_BATCH = 100
    for (let i = 0; i < clienteIdsAlvo.length; i += DELETE_BATCH) {
      const ids = clienteIdsAlvo.slice(i, i + DELETE_BATCH)
      const { error: delErr } = await supabaseClient
        .from('precos_servicos')
        .delete()
        .in('cliente_id', ids)
      if (delErr) {
        console.error(`❌ Erro ao remover preços existentes (lote ${Math.floor(i/DELETE_BATCH)+1}):`, delErr)
      } else {
        console.log(`✅ Removidos preços antigos de ${ids.length} cliente(s) (lote ${Math.floor(i/DELETE_BATCH)+1})`)
      }
    }

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

    // 7. Aplicar validação/correlação automática de clientes
    try {
      console.log('🔄 Aplicando validação automática de clientes...')
      const { data: validationResult, error: validationError } = await supabaseClient
        .rpc('aplicar_validacao_cliente_volumetria', { lote_upload_param: null })

      if (validationError) {
        console.error('❌ Erro na validação automática:', validationError)
      } else {
        console.log('✅ Validação automática concluída:', validationResult)
      }
    } catch (error) {
      console.error('❌ Erro ao executar validação automática:', error.message)
    }

    // 8. Finalizar log
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
    
    // Log dos primeiros erros para debug
    if (erros.length > 0) {
      console.log('🚨 Primeiros 10 erros encontrados:')
      erros.slice(0, 10).forEach(erro => console.log(`   - ${erro}`))
    }

    // 8. Retornar resposta
    return new Response(
      JSON.stringify({
        success: registrosInseridos > 0,
        registros_processados: registrosInseridos,
        registros_erro: erros.length + registrosComErro,
        total_linhas: jsonData.length - 1,
        mensagem: `Processamento concluído. ${registrosInseridos} preços inseridos com sucesso. ${erros.length + registrosComErro} erros encontrados.`,
        detalhes_erros: erros.slice(0, 10) // Primeiros 10 erros para debugging
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