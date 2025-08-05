import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para processamento em background
async function processarLotesBackground(
  supabaseClient: any,
  dadosRestantes: any[],
  logId: string,
  processedSoFar: number,
  errorsSoFar: number
) {
  const LOTE_SIZE = 20
  let registrosProcessados = processedSoFar
  let registrosErro = errorsSoFar
  const erros: string[] = []

  console.log(`🔄 Processando ${dadosRestantes.length} registros em background...`)

  for (let loteIndex = 0; loteIndex < dadosRestantes.length; loteIndex += LOTE_SIZE) {
    const lote = dadosRestantes.slice(loteIndex, loteIndex + LOTE_SIZE)
    
    // Processar lote
    for (const item of lote) {
      try {
        const { linha, cliente, modalidade, especialidade, categoria, prioridade, valor } = item

        // Buscar cliente no banco
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from('clientes')
          .select('id')
          .ilike('nome', `%${cliente}%`)
          .limit(1)
          .single()

        if (clienteError || !clienteData) {
          erros.push(`Linha ${linha}: Cliente "${cliente}" não encontrado`)
          registrosErro++
          continue
        }

        // Inserir preço - valor_urgencia será igual ao valor_base por enquanto (parâmetros ainda não implementados)
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .upsert({
            cliente_id: clienteData.id,
            modalidade: modalidade,
            especialidade: especialidade,
            categoria: categoria,
            prioridade: prioridade,
            valor_base: valor,
            valor_urgencia: valor, // Por enquanto igual ao valor_base
            ativo: true
          }, {
            onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
          })

        if (insertError) {
          erros.push(`Linha ${linha}: Erro ao inserir - ${insertError.message}`)
          registrosErro++
          continue
        }

        registrosProcessados++

      } catch (error) {
        erros.push(`Linha ${item.linha}: ${error.message}`)
        registrosErro++
      }
    }

    // Log de progresso
    console.log(`✅ Lote processado: ${registrosProcessados} sucessos, ${registrosErro} erros`)
    
    // Pequena pausa entre lotes para evitar sobrecarga
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Atualizar contratos
  console.log('🔄 Atualizando status dos contratos...')
  try {
    await supabaseClient.rpc('atualizar_status_configuracao_contrato')
  } catch (error) {
    console.error('❌ Erro ao atualizar contratos:', error.message)
  }

  // Finalizar log
  const status = registrosErro > registrosProcessados ? 'failed' : 'success'
  await supabaseClient
    .from('upload_logs')
    .update({
      status: status,
      records_processed: registrosProcessados,
      error_count: registrosErro,
      error_details: erros.slice(0, 10).join('; ')
    })
    .eq('id', logId)

  console.log(`🎉 Processamento final: ${registrosProcessados} sucessos, ${registrosErro} erros`)
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

    // 1. Criar log de processamento
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
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Processar arquivo Excel
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
    
    console.log(`📋 Total de linhas no Excel: ${jsonData.length}`)
    console.log(`🏷️ Headers: ${JSON.stringify(jsonData[0])}`)

    // 3. Validar e preparar dados (processamento rápido)
    const dadosValidados = []
    const errosIniciais: string[] = []
    const PRIMEIRAS_LINHAS = 15 // Processar apenas as primeiras 15 linhas de forma síncrona

    for (let i = 1; i < Math.min(jsonData.length, PRIMEIRAS_LINHAS + 1); i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row || row.length < 4) {
          console.log(`⚠️ Linha ${i}: dados insuficientes - ${row ? row.length : 0} colunas`)
          continue
        }

        // Mapear campos conforme estrutura do Excel
        // CLIENTE | DT INÍCIO VIGÊNCIA | DT FIM VIGÊNCIA | MODALIDADE | ESPECIALIDADE | PRIORIDADE | CATEGORIA | VALOR | VOL INICIAL | VOL FINAL | VOLUME TOTAL | CONSIDERA PLANTAO | TEM ADITIVO
        const cliente = String(row[0] || '').trim()
        const dtInicioVigencia = String(row[1] || '').trim()
        const dtFimVigencia = String(row[2] || '').trim()
        const modalidade = String(row[3] || '').trim() 
        const especialidade = String(row[4] || '').trim()
        const prioridade = String(row[5] || '').trim()
        const categoria = String(row[6] || '').trim()
        const valorStr = String(row[7] || '').trim()
        const volInicial = String(row[8] || '').trim()
        const volFinal = String(row[9] || '').trim()
        const volumeTotal = String(row[10] || '').trim()
        const consideraPlantao = String(row[11] || '').trim()
        const temAditivo = String(row[12] || '').trim()
        
        // Se não encontrou valor na posição esperada, buscar em outras colunas
        let valorFinal = valorStr
        if (!valorFinal || !(/[\d,.]/.test(valorFinal))) {
          for (let col = 7; col < row.length; col++) {
            const cellValue = String(row[col] || '').trim()
            if (cellValue && /[\d,.]/.test(cellValue)) {
              valorFinal = cellValue
              break
            }
          }
        }
        
        // Se não encontrou valor, pular linha
        if (!valorFinal) {
          errosIniciais.push(`Linha ${i}: Valor não encontrado`)
          continue
        }
        
        // Limpar e converter valor
        const valorLimpo = valorFinal.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
        const valorConvertido = valorLimpo.includes(',') && !valorLimpo.includes('.') ? 
          valorLimpo.replace(',', '.') : valorLimpo
        const valor = parseFloat(valorConvertido)

        // Validar dados essenciais
        if (!cliente || cliente.length < 2) {
          errosIniciais.push(`Linha ${i}: Cliente inválido - "${cliente}"`)
          continue
        }

        if (!modalidade || modalidade.length < 1) {
          errosIniciais.push(`Linha ${i}: Modalidade inválida - "${modalidade}"`)
          continue
        }

        if (!especialidade || especialidade.length < 1) {
          errosIniciais.push(`Linha ${i}: Especialidade inválida - "${especialidade}"`)
          continue
        }

        if (isNaN(valor) || valor <= 0) {
          errosIniciais.push(`Linha ${i}: Valor inválido - "${valorFinal}" => ${valor}`)
          continue
        }

        dadosValidados.push({
          linha: i,
          cliente,
          dtInicioVigencia,
          dtFimVigencia,
          modalidade,
          especialidade,
          categoria: categoria || 'Normal',
          prioridade: prioridade || 'Rotina',
          valor,
          volInicial: volInicial ? parseInt(volInicial) || null : null,
          volFinal: volFinal ? parseInt(volFinal) || null : null,
          volumeTotal: volumeTotal ? parseInt(volumeTotal) || null : null,
          consideraPlantao: consideraPlantao.toLowerCase() === 'sim' || consideraPlantao.toLowerCase() === 'true',
          temAditivo: temAditivo.toLowerCase() === 'sim' || temAditivo.toLowerCase() === 'true'
        })

      } catch (error) {
        errosIniciais.push(`Linha ${i}: ${error.message}`)
      }
    }

    // 4. Preparar dados restantes para processamento em background
    const dadosRestantes = []
    for (let i = PRIMEIRAS_LINHAS + 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row || row.length < 8) continue

        const cliente = String(row[0] || '').trim()
        const modalidade = String(row[3] || '').trim() 
        const especialidade = String(row[4] || '').trim()
        const prioridade = String(row[5] || '').trim()
        const categoria = String(row[6] || '').trim()
        const valorStr = String(row[7] || '').trim()
        
        // Se não encontrou valor na posição esperada, buscar em outras colunas
        let valorFinal = valorStr
        if (!valorFinal || !(/[\d,.]/.test(valorFinal))) {
          for (let col = 7; col < row.length; col++) {
            const cellValue = String(row[col] || '').trim()
            if (cellValue && /[\d,.]/.test(cellValue)) {
              valorFinal = cellValue
              break
            }
          }
        }
        
        if (!valorFinal) continue
        
        const valorLimpo = valorFinal.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
        const valorConvertido = valorLimpo.includes(',') && !valorLimpo.includes('.') ? 
          valorLimpo.replace(',', '.') : valorLimpo
        const valor = parseFloat(valorConvertido)

        if (!cliente || cliente.length < 2 || !modalidade || !especialidade || isNaN(valor) || valor <= 0) {
          continue
        }

        dadosRestantes.push({
          linha: i,
          cliente,
          modalidade,
          especialidade,
          categoria: categoria || 'Normal',
          prioridade: prioridade || 'Rotina',
          valor
        })

      } catch (error) {
        console.log(`Erro preparando linha ${i}:`, error.message)
      }
    }

    // 5. Processar primeiras linhas sincronamente
    let registrosProcessados = 0
    let registrosErro = errosIniciais.length

    for (const item of dadosValidados) {
      try {
        const { linha, cliente, modalidade, especialidade, categoria, prioridade, valor } = item

        // Buscar cliente no banco
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from('clientes')
          .select('id')
          .ilike('nome', `%${cliente}%`)
          .limit(1)
          .single()

        if (clienteError || !clienteData) {
          registrosErro++
          continue
        }

        // Inserir preço - valor_urgencia será igual ao valor_base por enquanto (parâmetros ainda não implementados)
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .upsert({
            cliente_id: clienteData.id,
            modalidade: modalidade,
            especialidade: especialidade,
            categoria: categoria,
            prioridade: prioridade,
            valor_base: valor,
            valor_urgencia: valor, // Por enquanto igual ao valor_base
            ativo: true
          }, {
            onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
          })

        if (insertError) {
          registrosErro++
          continue
        }

        registrosProcessados++

      } catch (error) {
        registrosErro++
      }
    }

    // 6. Iniciar processamento em background para dados restantes
    if (dadosRestantes.length > 0) {
      console.log(`🚀 Iniciando processamento em background de ${dadosRestantes.length} registros...`)
      
      // Usar waitUntil para processamento em background
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(
          processarLotesBackground(
            supabaseClient,
            dadosRestantes,
            logEntry.id,
            registrosProcessados,
            registrosErro
          )
        )
      } else {
        // Fallback se EdgeRuntime não estiver disponível
        processarLotesBackground(
          supabaseClient,
          dadosRestantes,
          logEntry.id,
          registrosProcessados,
          registrosErro
        ).catch(err => console.error('Erro no processamento background:', err))
      }
    }

    console.log(`✅ Processamento inicial: ${registrosProcessados} sucessos, ${registrosErro} erros`)
    console.log(`🔄 ${dadosRestantes.length} registros sendo processados em background`)

    // 7. Retornar resposta imediata
    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: registrosProcessados,
        registros_erro: registrosErro,
        processamento_background: dadosRestantes.length,
        mensagem: `${registrosProcessados} preços processados. ${dadosRestantes.length} sendo processados em background.`
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
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})