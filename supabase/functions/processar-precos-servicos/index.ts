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

    const { fileName } = await req.json()
    
    if (!fileName) {
      throw new Error('Nome do arquivo não foi fornecido')
    }

    console.log(`📁 Iniciando processamento: ${fileName}`)

    // Baixar arquivo
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`)
    }

    // Limpar uploads travados antigos
    await supabaseClient
      .from('upload_logs')
      .delete()
      .eq('file_type', 'precos_servicos')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    // Criar log
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
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    console.log(`✅ Processamento iniciado - Log ID: ${logEntry.id}`)

    // PROCESSAR EM BACKGROUND
    const processarEmBackground = async () => {
      try {
        // Parse Excel
        const arrayBuffer = await fileData.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
        
        console.log(`📋 Total de linhas: ${jsonData.length}`)

        // Normalizar headers
        const normalizeHeader = (s: any) => {
          return String(s ?? '')
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9]/g, '')
            .trim()
        }
        
        const headers = (jsonData[0] as any[]).map(normalizeHeader)
        
        const findIndex = (...candidates: string[]) => {
          for (const c of candidates) {
            const normalized = normalizeHeader(c)
            const idx = headers.indexOf(normalized)
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
          condVolume: findIndex('VOLUME TOTAL', 'VOLUMETOTAL', 'COND. VOLUME', 'COND VOLUME', 'CONDVOLUME'),
          consideraPlantao: findIndex('CONSIDERA PLANTAO', 'CONSIDERA PLANTAO?', 'PLANTAO', 'PLANTÃO')
        }

        // Funções auxiliares
        const normalizeClientName = (input: any): string => {
          let s = String(input ?? '').toUpperCase().trim()
          s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          
          // Mapeamentos conhecidos
          const mappings: Record<string, string> = {
            'INTERCOR2': 'INTERCOR',
            'P-HADVENTISTA': 'HADVENTISTA',
            'P-UNIMED_CARUARU': 'UNIMED_CARUARU',
            'PRN - MEDIMAGEM CAMBORIU': 'MEDIMAGEM_CAMBORIU',
            'PRN': 'MEDIMAGEM_CAMBORIU',
            'UNIMAGEM_CENTRO': 'UNIMAGEM_ATIBAIA',
            'VIVERCLIN 2': 'VIVERCLIN',
          }
          
          if (mappings[s]) s = mappings[s]
          
          // Normalizar CEDI
          if (s.startsWith('CEDI')) s = 'CEDIDIAG'
          
          return s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
        }

        const normalizeCondVolume = (input: any): 'MOD' | 'MOD/ESP' | 'MOD/ESP/CAT' | 'TOTAL' | null => {
          if (input == null) return null
          if (typeof input === 'number') return 'TOTAL'
          
          const raw = String(input).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          if (/^\s*\d+(?:[\.,]\d+)?\s*$/.test(raw)) return 'TOTAL'
          
          const token = raw.replace(/[^A-Z/]/g, '').replace(/\s+/g, '')
          
          if (token === 'MOD' || token === 'MODALIDADE') return 'MOD'
          if (token === 'MODESP' || token === 'MOD/ESP' || token === 'MODALIDADE/ESPECIALIDADE' || token === 'MODALIDADEESPECIALIDADE') return 'MOD/ESP'
          if (token === 'MODESPCAT' || token === 'MOD/ESP/CAT' || token === 'MODALIDADE/ESPECIALIDADE/CATEGORIA' || token === 'MODALIDADEESPECIALIDADECATEGORIA') return 'MOD/ESP/CAT'
          if (token === 'TOTAL' || token === 'VOLUMETOTAL' || token === 'TODOS' || token === 'GERAL' || token === 'VOLUME') return 'TOTAL'
          
          return null
        }

        // Buscar clientes
        const { data: clientesData } = await supabaseClient
          .from('clientes')
          .select('id, nome, nome_mobilemed, nome_fantasia')
          .eq('ativo', true)

        const clientesMap = new Map<string, string>()
        const clientesNomeOficialMap = new Map<string, string>()
        
        clientesData?.forEach((cliente: any) => {
          const nomeOficial = cliente.nome_fantasia || cliente.nome
          clientesNomeOficialMap.set(cliente.id, nomeOficial)
          
          const addMapping = (k?: string | null) => {
            if (!k) return
            const raw = String(k).toUpperCase().trim()
            const normalized = normalizeClientName(raw)
            if (raw) clientesMap.set(raw, cliente.id)
            if (normalized && normalized !== raw) clientesMap.set(normalized, cliente.id)
          }
          
          addMapping(cliente.nome)
          addMapping(cliente.nome_mobilemed)
          addMapping(cliente.nome_fantasia)
        })

        // Buscar mapeamentos
        const { data: mapeamentosData } = await supabaseClient
          .from('mapeamento_nomes_clientes')
          .select('nome_arquivo, nome_sistema')
          .eq('ativo', true)

        const mapeamentosMap = new Map()
        mapeamentosData?.forEach(m => {
          mapeamentosMap.set(m.nome_arquivo.toUpperCase().trim(), m.nome_sistema.toUpperCase().trim())
        })

        // Processar linhas
        const registrosParaInserir: any[] = []
        const erros: string[] = []

        for (let i = 1; i < jsonData.length; i++) {
          try {
            const row = jsonData[i] as any[]
            if (!row) continue

            const get = (idx: number) => (idx >= 0 ? row[idx] : undefined)
            
            const clienteNomeOriginal = String(get(indices.cliente) ?? '').trim()
            const modalidade = String(get(indices.modalidade) ?? '').trim()
            const especialidade = String(get(indices.especialidade) ?? '').trim()
            const prioridade = String(get(indices.prioridade) ?? '').trim()
            let categoria = String(get(indices.categoria) ?? '').trim()
            const precoStr = String(get(indices.valor) ?? '').trim()
            const volInicial = get(indices.volInicial) != null && String(get(indices.volInicial)).trim() !== '' ? parseInt(String(get(indices.volInicial))) || null : null
            const volFinal = get(indices.volFinal) != null && String(get(indices.volFinal)).trim() !== '' ? parseInt(String(get(indices.volFinal))) || null : null
            const condVolumeRaw = get(indices.condVolume)
            const condVolume = normalizeCondVolume(condVolumeRaw)
            const consideraPlantao = ['sim','s','true','1','x'].includes(String(get(indices.consideraPlantao) ?? '').toLowerCase())
            
            if (!categoria || categoria === 'Normal') categoria = 'N/A'

            // Buscar cliente
            const clienteNomeBuscaRaw = clienteNomeOriginal.toUpperCase().trim()
            let clienteNomeBusca = normalizeClientName(clienteNomeBuscaRaw)
            
            const nomeMapeado = mapeamentosMap.get(clienteNomeBuscaRaw) || mapeamentosMap.get(clienteNomeBusca)
            if (nomeMapeado) {
              clienteNomeBusca = normalizeClientName(nomeMapeado)
            }
            
            const clienteId = clientesMap.get(clienteNomeBuscaRaw) || clientesMap.get(clienteNomeBusca)
            
            let observacoes = ''
            if (!clienteId) observacoes = `Cliente não localizado: ${clienteNomeOriginal}. `

            // Converter preço
            let preco = 0
            if (precoStr) {
              const precoLimpo = precoStr.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
              const precoConvertido = precoLimpo.includes(',') && !precoLimpo.includes('.') ? 
                precoLimpo.replace(',', '.') : precoLimpo
              preco = parseFloat(precoConvertido) || 0
            }
            preco = Math.round(preco * 100) / 100

            const clienteNomeFinal = clienteId ? clientesNomeOficialMap.get(clienteId) || clienteNomeOriginal : clienteNomeOriginal
            
            registrosParaInserir.push({
              cliente_id: clienteId || null,
              cliente_nome: clienteNomeFinal,
              modalidade: modalidade || 'N/A',
              especialidade: especialidade || 'N/A',
              categoria: categoria || null,
              prioridade: prioridade || 'N/A',
              valor_base: preco,
              volume_inicial: volInicial,
              volume_final: volFinal,
              cond_volume: condVolume,
              considera_prioridade_plantao: consideraPlantao,
              tipo_preco: 'especial',
              aplicar_legado: true,
              aplicar_incremental: true,
              ativo: true,
              observacoes: observacoes || null,
              descricao: clienteId ? null : `Cliente original: ${clienteNomeOriginal}`,
              linha_arquivo: i + 1
            })
          } catch (error) {
            erros.push(`Linha ${i + 1}: ${error.message}`)
          }
        }

        console.log(`📊 ${registrosParaInserir.length} registros válidos`)

        // Deletar preços existentes dos clientes no arquivo
        const clienteIdsAlvo = Array.from(new Set(registrosParaInserir.map(r => r.cliente_id).filter((id): id is string => !!id)))
        
        for (let i = 0; i < clienteIdsAlvo.length; i += 100) {
          const ids = clienteIdsAlvo.slice(i, i + 100)
          await supabaseClient.from('precos_servicos').delete().in('cliente_id', ids)
        }

        // Inserir em lotes menores
        let registrosInseridos = 0
        let registrosComErro = 0
        const BATCH_SIZE = 200
        const MAX_RETRIES = 2

        for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
          const lote = registrosParaInserir.slice(i, i + BATCH_SIZE)
          const loteNum = Math.floor(i/BATCH_SIZE) + 1
          const totalLotes = Math.ceil(registrosParaInserir.length / BATCH_SIZE)
          
          let tentativa = 0
          let sucesso = false
          
          while (tentativa <= MAX_RETRIES && !sucesso) {
            try {
              console.log(`📦 Lote ${loteNum}/${totalLotes} (${lote.length} registros)`)
              
              const { error: insertError } = await supabaseClient
                .from('precos_servicos')
                .insert(lote)

              if (insertError) {
                if (insertError.code === '57014' && tentativa < MAX_RETRIES) {
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  tentativa++
                } else {
                  registrosComErro += lote.length
                  sucesso = true
                }
              } else {
                registrosInseridos += lote.length
                console.log(`✅ Lote ${loteNum}/${totalLotes} inserido (${registrosInseridos}/${registrosParaInserir.length})`)
                sucesso = true
              }
            } catch (error) {
              if (tentativa < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000))
                tentativa++
              } else {
                registrosComErro += lote.length
                sucesso = true
              }
            }
          }
          
          // Pequeno delay entre lotes
          if (i + BATCH_SIZE < registrosParaInserir.length) {
            await new Promise(resolve => setTimeout(resolve, 150))
          }
        }

        // Sincronizar com contratos
        try {
          await supabaseClient.rpc('sincronizar_precos_servicos_contratos')
          await supabaseClient.rpc('atualizar_status_configuracao_contrato')
        } catch (error) {
          console.error('Erro ao sincronizar:', error)
        }

        // Validação de clientes
        try {
          await supabaseClient.rpc('aplicar_validacao_cliente_volumetria', { lote_upload_param: null })
        } catch (error) {
          console.error('Erro na validação:', error)
        }

        // Identificar duplicados
        const { data: duplicados } = await supabaseClient.rpc('identificar_duplicados_precos_servicos')

        // Finalizar log
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

        console.log(`🎉 Concluído: ${registrosInseridos} inseridos, ${erros.length + registrosComErro} erros`)

      } catch (bgError) {
        console.error('💥 Erro no background:', bgError.message)
        
        await supabaseClient
          .from('upload_logs')
          .update({
            status: 'failed',
            error_message: bgError.message
          })
          .eq('id', logEntry.id)
      }
    }

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(processarEmBackground())

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({
        success: true,
        mensagem: 'Processamento iniciado. Acompanhe o progresso na tela.',
        log_id: logEntry.id,
        file_name: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Erro ao iniciar:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
