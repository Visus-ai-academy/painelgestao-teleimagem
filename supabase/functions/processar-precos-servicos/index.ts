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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar arquivo do storage ao invés de FormData
    const { fileName } = await req.json()
    
    if (!fileName) {
      throw new Error('Nome do arquivo não foi fornecido')
    }

    console.log(`📁 Buscando arquivo do storage: ${fileName}`)

    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError || !fileData) {
      console.error('❌ Erro ao baixar arquivo:', downloadError)
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`)
    }

    console.log(`📊 Tamanho: ${fileData.size} bytes`)

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
        filename: fileName,
        file_type: 'precos_servicos',
        status: 'processing',
        file_size: fileData.size,
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
    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
    
    console.log(`📋 Total de linhas no Excel: ${jsonData.length}`)
    console.log(`🏷️ Headers: ${JSON.stringify(jsonData[0])}`)

    // 🧭 Mapear índices por header para suportar variações de templates
    const normalizeHeader = (s: any) => String(s ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    const headers = (jsonData[0] as any[]).map(normalizeHeader)
    const findIndex = (...candidates: string[]) => {
      for (const c of candidates) {
        const idx = headers.indexOf(c)
        if (idx !== -1) return idx
      }
      return -1
    }
    const indices = {
      cliente: findIndex(
        'CLIENTE', 'NOME DO CLIENTE', 'CLIENTE NOME', 'CLIENTE FANTASIA', 'NOME FANTASIA',
        'CLIENTE/UNIDADE', 'CLIENTE_UNIDADE', 'UNIDADE', 'EMPRESA', 'CLINICA', 'CLÍNICA', 'HOSPITAL', 'PARCEIRO'
      ),
      modalidade: findIndex('MODALIDADE'),
      especialidade: findIndex('ESPECIALIDADE'),
      prioridade: findIndex('PRIORIDADE'),
      categoria: findIndex('CATEGORIA'),
      valor: findIndex('VALOR', 'PRECO', 'PREÇO'),
      volInicial: findIndex('VOL INICIAL', 'VOLUME INICIAL'),
      volFinal: findIndex('VOL FINAL', 'VOLUME FINAL'),
      condVolume: findIndex('VOLUME TOTAL', 'COND VOLUME', 'COND. VOLUME'),
      consideraPlantao: findIndex('CONSIDERA PLANTAO', 'PLANTAO', 'CONSIDERA PLANTAO?')
    }
    console.log('🧭 Índices detectados:', indices)

    // Normalização de nomes de clientes (espelha regras do banco)
    const normalizeClientName = (input: any): string => {
      let s = String(input ?? '').toUpperCase().trim()
      // Remover acentos
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Mapeamentos específicos
      switch (s) {
        case 'INTERCOR2': s = 'INTERCOR'; break
        case 'P-HADVENTISTA': s = 'HADVENTISTA'; break
        case 'P-UNIMED_CARUARU': s = 'UNIMED_CARUARU'; break
        case 'PRN - MEDIMAGEM CAMBORIU': s = 'MEDIMAGEM_CAMBORIU'; break
        case 'PRN': s = 'MEDIMAGEM_CAMBORIU'; break
        case 'UNIMAGEM_CENTRO': s = 'UNIMAGEM_ATIBAIA'; break
        case 'VIVERCLIN 2': s = 'VIVERCLIN'; break
        case 'CEDI-RJ':
        case 'CEDI-RO':
        case 'CEDI-UNIMED':
        case 'CEDI_RJ':
        case 'CEDI_RO':
        case 'CEDI_UNIMED': s = 'CEDIDIAG'; break
        default: break
      }
      // Remover prefixos e sufixos comuns
      const removeSuffix = (str: string, suffix: string) => str.endsWith(suffix) ? str.slice(0, -suffix.length) : str
      const removePrefix = (str: string, prefix: string) => str.startsWith(prefix) ? str.slice(prefix.length) : str
      s = removeSuffix(s, '- TELE')
      s = removeSuffix(s, '-CT')
      s = removeSuffix(s, '-MR')
      s = removeSuffix(s, '_PLANTAO')
      s = removeSuffix(s, '_PLANTÃO')
      s = removeSuffix(s, '_RMX')
      s = removePrefix(s, 'P-')
      s = removePrefix(s, 'P_')
      s = removePrefix(s, 'NL_')
      // Remover pontos e normalizar espaços
      s = s.replace(/\./g, ' ')
      s = s.replace(/\s+/g, ' ').trim()
      return s.trim().toUpperCase()
    }

    // Fingerprint para matching flexível (ignora espaços e pontuação)
    const fingerprint = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const stripTrailingDigits = (s: string) => s.replace(/\d+$/,'')

    // 3. Buscar todos os clientes uma vez para melhor performance
    const { data: clientesData, error: clientesError } = await supabaseClient
      .from('clientes')
      .select('id, nome, nome_mobilemed, nome_fantasia')
      .eq('ativo', true)

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`)
    }

    const clientesMap = new Map<string, string>()
    clientesData.forEach((cliente: any) => {
      const add = (k?: string | null, priority: number = 0) => {
        if (!k) return
        const str = String(k)
        const keyNorm = normalizeClientName(str)
        const raw = str.toUpperCase().trim()
        const variants = new Set<string>([
          keyNorm,
          raw,
          fingerprint(keyNorm),
          fingerprint(raw),
          stripTrailingDigits(keyNorm),
          stripTrailingDigits(raw),
          fingerprint(stripTrailingDigits(keyNorm)),
          fingerprint(stripTrailingDigits(raw)),
        ])
        for (const v of variants) {
          if (v) {
            // Só sobrescrever se não existir ou se a nova prioridade for maior
            const existing = clientesMap.get(v)
            if (!existing || priority > 0) {
              clientesMap.set(v, cliente.id)
            }
          }
        }
      }
      // PRIORIDADE: nome_fantasia é a referência principal (priority 2)
      // nome_mobilemed é secundário (priority 1)
      // nome é terciário (priority 0)
      add(cliente.nome, 0)
      add(cliente.nome_mobilemed, 1)
      add(cliente.nome_fantasia, 2)
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
    const registrosParaInserir: any[] = []
    const erros: string[] = []
    let registrosProcessados = 0

    for (let i = 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row) {
          erros.push(`Linha ${i + 1}: linha vazia`)
        }

        // Mapear campos do Excel baseado nos headers detectados
        const get = (idx: number) => (idx >= 0 ? row[idx] : undefined)
        const clienteNomeOriginal = String(get(indices.cliente) ?? '').trim() // Nome EXATO do arquivo
        const clienteNome = clienteNomeOriginal // Usar para display
        const modalidade = String(get(indices.modalidade) ?? '').trim()
        const especialidade = String(get(indices.especialidade) ?? '').trim()
        const prioridade = String(get(indices.prioridade) ?? '').trim()
        let categoria = String(get(indices.categoria) ?? '').trim()
        const precoStr = String(get(indices.valor) ?? '').trim()
        const volInicial = get(indices.volInicial) != null && String(get(indices.volInicial)).trim() !== '' ? parseInt(String(get(indices.volInicial))) || null : null
        const volFinal = get(indices.volFinal) != null && String(get(indices.volFinal)).trim() !== '' ? parseInt(String(get(indices.volFinal))) || null : null
        const condVolume = get(indices.condVolume) != null && String(get(indices.condVolume)).trim() !== '' ? parseInt(String(get(indices.condVolume))) || null : null
        const consideraPlantao = ['sim','s','true','1','x'].includes(String(get(indices.consideraPlantao) ?? '').toLowerCase())
        let observacoesRow = ''
        
        // Tratar categoria vazia ou "Normal" como "N/A"
        if (!categoria || categoria === 'Normal' || categoria === '') {
          categoria = 'N/A'
        }

        // Log para debug das primeiras linhas
        if (i <= 5) {
          console.log(`🔍 Linha ${i + 1}: Cliente="${clienteNome}", Modal="${modalidade}", Espec="${especialidade}", Prior="${prioridade}", Preço="${precoStr}"`)
        }

        // Validação removida - aceitar todos os registros mesmo sem cliente válido

        // Aceitar modalidade vazia
        const modalidadeFinal = modalidade || 'N/A'

        // Aceitar especialidade vazia  
        const especialidadeFinal = especialidade || 'N/A'

        // Aceitar prioridade vazia
        const prioridadeFinal = prioridade || 'N/A'

        // Aceitar preços vazios (serão tratados como 0)

        // Buscar cliente (com normalização e mapeamento de nomes)
        const clienteNomeBuscaRaw = clienteNome.toUpperCase()
        let clienteNomeBusca = normalizeClientName(clienteNomeBuscaRaw)
        
        // Verificar se existe mapeamento para o nome (raw e normalizado)
        const nomeMapeado = mapeamentosMap.get(clienteNomeBuscaRaw) || mapeamentosMap.get(clienteNomeBusca)
        if (nomeMapeado) {
          clienteNomeBusca = normalizeClientName(nomeMapeado)
          console.log(`🔄 Mapeamento aplicado: "${clienteNome}" → "${nomeMapeado}"`)
        }
        
        // Tentar múltiplas chaves de matching (inclui fingerprint e remoção de dígitos finais)
        const fpNorm = fingerprint(clienteNomeBusca)
        const fpRaw = fingerprint(clienteNomeBuscaRaw)
        const strippedNorm = stripTrailingDigits(clienteNomeBusca)
        const strippedRaw = stripTrailingDigits(clienteNomeBuscaRaw)
        const fpStrippedNorm = fingerprint(strippedNorm)
        const fpStrippedRaw = fingerprint(strippedRaw)

        const clienteId =
          clientesMap.get(clienteNomeBusca) ||
          clientesMap.get(clienteNomeBuscaRaw) ||
          clientesMap.get(fpNorm) ||
          clientesMap.get(fpRaw) ||
          clientesMap.get(strippedNorm) ||
          clientesMap.get(strippedRaw) ||
          clientesMap.get(fpStrippedNorm) ||
          clientesMap.get(fpStrippedRaw)
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

        // Preparar registro para inserção (SEM deduplicação - aceitar todos os registros)
        // IMPORTANTE: Manter o nome EXATO do arquivo Excel (clienteNomeOriginal) sem normalização
        registrosParaInserir.push({
          cliente_id: clienteId || null,
          modalidade: modalidadeFinal,
          especialidade: especialidadeFinal,
          categoria: categoria && categoria.trim() !== '' ? categoria : null,
          prioridade: prioridadeFinal,
          valor_base: preco,
          volume_inicial: volInicial,
          volume_final: volFinal,
          volume_total: condVolume,
          considera_prioridade_plantao: consideraPlantao,
          tipo_preco: 'especial',
          aplicar_legado: true,
          aplicar_incremental: true,
          ativo: true,
          observacoes: observacoesRow || null,
          descricao: clienteId ? null : `Cliente original: ${clienteNomeOriginal}`, // Usar nome ORIGINAL do arquivo
          linha_arquivo: i + 1  // Adicionar número da linha do Excel (1-indexed)
        })

        registrosProcessados++

      } catch (error) {
        erros.push(`Linha ${i + 1}: ${error.message}`)
      }
    }

    console.log(`📊 Total de linhas processadas: ${registrosProcessados}`)
    console.log(`📦 Registros válidos para inserção: ${registrosParaInserir.length}`)
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

    // 5. Inserir registros no banco em lotes com retry automático
    let registrosInseridos = 0
    let registrosComErro = 0
    const BATCH_SIZE = 300 // Reduzido ainda mais para evitar timeouts
    const MAX_RETRIES = 2

    for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
      const lote = registrosParaInserir.slice(i, i + BATCH_SIZE)
      const loteNum = Math.floor(i/BATCH_SIZE) + 1
      const totalLotes = Math.ceil(registrosParaInserir.length / BATCH_SIZE)
      
      let tentativa = 0
      let sucesso = false
      
      while (tentativa <= MAX_RETRIES && !sucesso) {
        try {
          if (tentativa > 0) {
            console.log(`🔄 Tentativa ${tentativa + 1}/${MAX_RETRIES + 1} para lote ${loteNum}...`)
          } else {
            console.log(`📦 Inserindo lote ${loteNum}/${totalLotes} (${lote.length} registros)...`)
          }
          
          const { error: insertError } = await supabaseClient
            .from('precos_servicos')
            .insert(lote)

          if (insertError) {
            if (insertError.code === '57014' && tentativa < MAX_RETRIES) {
              // Timeout - tentar novamente após delay maior
              console.warn(`⚠️ Timeout no lote ${loteNum}, aguardando para retry...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
              tentativa++
            } else {
              console.error(`❌ Erro ao inserir lote ${loteNum}:`, insertError)
              registrosComErro += lote.length
              sucesso = true // Não tentar mais
            }
          } else {
            registrosInseridos += lote.length
            console.log(`✅ Lote ${loteNum}/${totalLotes} inserido (${registrosInseridos}/${registrosParaInserir.length})`)
            sucesso = true
          }
          
        } catch (error) {
          if (tentativa < MAX_RETRIES) {
            console.warn(`⚠️ Erro no lote ${loteNum}, tentando novamente...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            tentativa++
          } else {
            console.error(`❌ Erro final no lote ${loteNum}:`, error)
            registrosComErro += lote.length
            sucesso = true
          }
        }
      }
      
      // Delay entre lotes para evitar sobrecarga
      if (i + BATCH_SIZE < registrosParaInserir.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
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

    // 8. Detectar duplicados após inserção
    console.log('🔍 Identificando duplicados...')
    const { data: duplicados, error: dupError } = await supabaseClient.rpc('identificar_duplicados_precos_servicos')
    
    if (dupError) {
      console.error('❌ Erro ao identificar duplicados:', dupError)
    } else if (duplicados && duplicados.length > 0) {
      console.log(`⚠️ Encontrados ${duplicados.length} grupos de registros duplicados`)
      duplicados.slice(0, 10).forEach((dup: any) => {
        console.log(`   - ${dup.cliente_nome || 'SEM CLIENTE'} | ${dup.modalidade} | ${dup.especialidade} | ${dup.prioridade} | ${dup.categoria}: ${dup.total_duplicados} registros`)
      })
    } else {
      console.log('✅ Nenhum duplicado encontrado')
    }

    // 9. Retornar resposta
    return new Response(
      JSON.stringify({
        success: registrosInseridos > 0,
        registros_processados: registrosInseridos,
        registros_erro: erros.length + registrosComErro,
        total_linhas: jsonData.length - 1,
        total_duplicados: duplicados?.length || 0,
        mensagem: `Processamento concluído. ${registrosInseridos} preços inseridos com sucesso. ${erros.length + registrosComErro} erros encontrados. ${duplicados?.length || 0} grupos duplicados detectados.`,
        detalhes_erros: erros.slice(0, 10), // Primeiros 10 erros para debugging
        detalhes_duplicados: duplicados?.slice(0, 20) || [] // Primeiros 20 duplicados
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