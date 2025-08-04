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

    console.log(`Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: file.name,
        file_type: 'precos_servicos',
        status: 'processing',
        file_size: file.size,
        uploader: req.headers.get('Authorization') ? 'authenticated_user' : 'anonymous'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não contém planilhas')
    }
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
    
    if (jsonData.length <= 1) {
      throw new Error('Arquivo Excel vazio ou sem dados')
    }

    // 3. Processar header e dados
    const headers = jsonData[0] as string[]
    console.log('Headers encontrados:', headers)
    console.log(`Total de linhas: ${jsonData.length - 1}`)

    let registrosProcessados = 0
    let registrosErro = 0
    const erros: string[] = []
    const BATCH_SIZE = 50 // Reduzido para 50 para evitar timeout
    const MAX_TIMEOUT = 240000 // 4 minutos máximo

    const startTime = Date.now()

    // 4. Processar em lotes para otimizar performance
    for (let batchStart = 1; batchStart < jsonData.length; batchStart += BATCH_SIZE) {
      // Verificar timeout
      if (Date.now() - startTime > MAX_TIMEOUT) {
        console.log('Timeout atingido, parando processamento')
        erros.push(`Timeout: processamento interrompido após ${Math.floor((Date.now() - startTime) / 1000)}s`)
        break
      }

      const batchEnd = Math.min(batchStart + BATCH_SIZE, jsonData.length)
      const batchData: any[] = []
      
      console.log(`Processando lote ${Math.floor(batchStart / BATCH_SIZE) + 1}: linhas ${batchStart} a ${batchEnd - 1}`)
      
      // Preparar dados do lote
      for (let i = batchStart; i < batchEnd; i++) {
        try {
          const row = jsonData[i] as any[]
          
          if (!row || row.length < 2) {
            continue
          }

          // Mapear campos do Excel de forma mais flexível
          const cliente = String(row[0] || '').trim()
          const modalidade = String(row[1] || '').trim()
          const especialidade = String(row[2] || '').trim()
          const categoria = String(row[3] || 'Normal').trim()
          const prioridade = String(row[4] || 'Rotina').trim()
          const valorStr = row[5] || row[6] || row[7] // Tentar várias colunas para o valor

          // Validações básicas
          if (!cliente || !modalidade || !especialidade || !valorStr) {
            erros.push(`Linha ${i + 1}: campos obrigatórios faltando`)
            registrosErro++
            continue
          }

          // Converter valor
          let valor: number
          if (typeof valorStr === 'number') {
            valor = valorStr
          } else {
            valor = parseFloat(String(valorStr).replace(/[R$\s]/g, '').replace(',', '.'))
          }
          
          if (isNaN(valor) || valor <= 0) {
            erros.push(`Linha ${i + 1}: valor inválido - ${valorStr}`)
            registrosErro++
            continue
          }

          batchData.push({
            cliente_nome: cliente,
            modalidade,
            especialidade,
            categoria,
            prioridade,
            valor
          })

        } catch (error) {
          erros.push(`Linha ${i + 1}: ${error.message}`)
          registrosErro++
        }
      }

      // Processar lote: buscar clientes e inserir preços
      if (batchData.length > 0) {
        try {
          // Buscar todos os clientes do lote de uma vez
          const clientesNomes = [...new Set(batchData.map(item => item.cliente_nome))]
          const { data: clientesData, error: clientesError } = await supabaseClient
            .from('clientes')
            .select('id, nome')
            .in('nome', clientesNomes)

          if (clientesError) {
            console.error('Erro ao buscar clientes:', clientesError.message)
            erros.push(`Erro ao buscar clientes: ${clientesError.message}`)
            registrosErro += batchData.length
            continue
          }

          // Criar mapa de clientes
          const clientesMap = new Map()
          clientesData?.forEach(cliente => {
            clientesMap.set(cliente.nome, cliente.id)
          })

          // Preparar dados para inserção
          const dadosParaInserir = []
          for (const item of batchData) {
            const clienteId = clientesMap.get(item.cliente_nome)
            if (!clienteId) {
              erros.push(`Cliente "${item.cliente_nome}" não encontrado`)
              registrosErro++
              continue
            }

            dadosParaInserir.push({
              cliente_id: clienteId,
              modalidade: item.modalidade,
              especialidade: item.especialidade,
              categoria: item.categoria,
              prioridade: item.prioridade,
              valor: item.valor,
              ativo: true
            })
          }

          // Inserir no banco
          if (dadosParaInserir.length > 0) {
            const { error: insertError } = await supabaseClient
              .from('precos_servicos')
              .upsert(dadosParaInserir, {
                onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
              })

            if (insertError) {
              console.error('Erro ao inserir lote:', insertError.message)
              erros.push(`Erro no lote: ${insertError.message}`)
              registrosErro += dadosParaInserir.length
            } else {
              registrosProcessados += dadosParaInserir.length
            }
          }

        } catch (error) {
          console.error('Erro no processamento do lote:', error.message)
          erros.push(`Erro no lote: ${error.message}`)
          registrosErro += batchData.length
        }
      }

      // Log de progresso
      console.log(`Lote processado: ${registrosProcessados} sucessos, ${registrosErro} erros`)
      
      // Pausa pequena para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // 5. Atualizar flags nos contratos dos clientes
    const { error: updateError } = await supabaseClient
      .rpc('atualizar_status_configuracao_contrato')

    if (updateError) {
      console.error('Erro ao atualizar status dos contratos:', updateError.message)
    }

    // 6. Atualizar log com resultado
    const status = registrosErro > registrosProcessados ? 'partial_success' : 'success'
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: status,
        records_processed: registrosProcessados,
        error_count: registrosErro,
        error_details: erros.length > 0 ? erros.slice(0, 20).join('; ') : null
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${registrosProcessados} registros processados, ${registrosErro} erros.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: registrosProcessados,
        registros_erro: registrosErro,
        erros: erros.slice(0, 10), // Primeiros 10 erros
        mensagem: `Processamento concluído: ${registrosProcessados} preços cadastrados`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro no processamento:', error)

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