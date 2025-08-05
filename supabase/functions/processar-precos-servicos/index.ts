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
  const LOTE_SIZE = 50 // Reduzido para melhor debugging
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

        console.log(`🔍 Buscando cliente: "${cliente}"`)

        // Buscar cliente no banco - estratégia melhorada
        let clienteData = null;
        
        // Primeiro, busca exata
        const { data: clienteExato, error: erroExato } = await supabaseClient
          .from('clientes')
          .select('id, nome')
          .eq('nome', cliente)
          .limit(1)
          .single()

        if (!erroExato && clienteExato) {
          clienteData = clienteExato;
          console.log(`✅ Cliente encontrado (busca exata): ${clienteData.nome}`)
        } else {
          // Se não encontrou, tenta busca por like
          const { data: clienteIlike, error: erroIlike } = await supabaseClient
            .from('clientes')
            .select('id, nome')
            .ilike('nome', `%${cliente}%`)
            .limit(1)
            .single()

          if (!erroIlike && clienteIlike) {
            clienteData = clienteIlike;
            console.log(`✅ Cliente encontrado (busca like): ${clienteData.nome}`)
          } else {
            console.log(`❌ Cliente não encontrado: "${cliente}"`)
            console.log(`❌ Erro busca exata:`, erroExato)
            console.log(`❌ Erro busca like:`, erroIlike)
            erros.push(`Linha ${linha}: Cliente "${cliente}" não encontrado`)
            registrosErro++
            continue
          }
        }

        console.log(`💰 Inserindo preço: Cliente=${clienteData.nome}, Modalidade=${modalidade}, Valor=${valor}`)

        // Inserir preço com todos os campos de volume e plantão
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .insert({
            cliente_id: clienteData.id,
            modalidade: modalidade,
            especialidade: especialidade,
            categoria: categoria,
            prioridade: prioridade,
            valor_base: valor,
            valor_urgencia: valor, // Por enquanto igual ao valor_base
            volume_inicial: item.volInicial,
            volume_final: item.volFinal,
            volume_total: item.condVolume ? parseInt(item.condVolume) || null : null,
            considera_prioridade_plantao: item.consideraPlantao,
            tipo_preco: 'especial',
            aplicar_legado: true,
            aplicar_incremental: true,
            ativo: true
          })

        if (insertError) {
          console.log(`❌ Erro ao inserir preço:`, insertError)
          erros.push(`Linha ${linha}: Erro ao inserir - ${insertError.message}`)
          registrosErro++
          continue
        }

        console.log(`✅ Preço inserido com sucesso`)
        registrosProcessados++

      } catch (error) {
        console.log(`❌ Erro geral na linha ${item.linha}:`, error.message)
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
    console.log('✅ Contratos atualizados')
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

    // 3. Preparar TODOS os dados para processamento em background
    const dadosValidados = []
    const errosIniciais: string[] = []

    for (let i = 1; i < jsonData.length; i++) {
      try {
        const row = jsonData[i] as any[]
        
        if (!row || row.length < 6) {
          console.log(`⚠️ Linha ${i}: dados insuficientes - ${row ? row.length : 0} colunas`)
          continue
        }

        // Mapear campos do Excel baseado nos headers corretos
        const cliente = String(row[0] || '').trim()
        const modalidade = String(row[1] || '').trim() 
        const especialidade = String(row[2] || '').trim()
        const prioridade = String(row[3] || '').trim()
        const categoria = String(row[4] || '').trim()
        const precoStr = String(row[5] || '').trim()
        const volInicial = String(row[6] || '').trim()
        const volFinal = String(row[7] || '').trim()
        const condVolume = String(row[8] || '').trim()
        const consideraPlantao = String(row[9] || '').trim()
        
        console.log(`📝 Linha ${i}: Cliente="${cliente}", Modalidade="${modalidade}", Preço="${precoStr}"`)
        
        // Buscar preço em múltiplas colunas se necessário
        let precoFinal = precoStr
        if (!precoFinal || !(/[\d,.]/.test(precoFinal))) {
          for (let col = 5; col < row.length; col++) {
            const cellValue = String(row[col] || '').trim()
            if (cellValue && /[\d,.]/.test(cellValue)) {
              precoFinal = cellValue
              break
            }
          }
        }
        
        if (!precoFinal) {
          errosIniciais.push(`Linha ${i}: Preço não encontrado`)
          continue
        }
        
        // Limpar e converter preço
        const precoLimpo = precoFinal.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '')
        const precoConvertido = precoLimpo.includes(',') && !precoLimpo.includes('.') ? 
          precoLimpo.replace(',', '.') : precoLimpo
        const preco = parseFloat(precoConvertido)

        // Validar dados essenciais
        if (!cliente || cliente.length < 2) {
          errosIniciais.push(`Linha ${i}: Cliente inválido - "${cliente}"`)
          continue
        }

        if (!modalidade) {
          errosIniciais.push(`Linha ${i}: Modalidade inválida - "${modalidade}"`)
          continue
        }

        if (!especialidade) {
          errosIniciais.push(`Linha ${i}: Especialidade inválida - "${especialidade}"`)
          continue
        }

        if (isNaN(preco) || preco <= 0) {
          errosIniciais.push(`Linha ${i}: Preço inválido ou zerado - "${precoFinal}" => ${preco}`)
          continue
        }

        dadosValidados.push({
          linha: i,
          cliente,
          modalidade,
          especialidade,
          categoria: categoria || 'Normal',
          prioridade: prioridade || 'Rotina',
          valor: preco,
          volInicial: volInicial ? parseInt(volInicial) || null : null,
          volFinal: volFinal ? parseInt(volFinal) || null : null,
          condVolume: condVolume,
          consideraPlantao: consideraPlantao.toLowerCase() === 'sim' || consideraPlantao.toLowerCase() === 'true'
        })

      } catch (error) {
        errosIniciais.push(`Linha ${i}: ${error.message}`)
      }
    }

    console.log(`📊 Dados validados: ${dadosValidados.length} registros`)
    console.log(`❌ Erros iniciais: ${errosIniciais.length}`)

    // 4. Iniciar processamento em background para TODOS os dados
    if (dadosValidados.length > 0) {
      console.log(`🚀 Iniciando processamento em background de ${dadosValidados.length} registros...`)
      
      // Usar waitUntil para processamento em background
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(
          processarLotesBackground(
            supabaseClient,
            dadosValidados,
            logEntry.id,
            0,
            errosIniciais.length
          )
        )
      } else {
        // Fallback se EdgeRuntime não estiver disponível
        processarLotesBackground(
          supabaseClient,
          dadosValidados,
          logEntry.id,
          0,
          errosIniciais.length
        ).catch(err => console.error('Erro no processamento background:', err))
      }
    }

    console.log(`✅ Processamento iniciado: ${dadosValidados.length} registros serão processados`)

    // 5. Retornar resposta imediata
    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: 0,
        registros_erro: errosIniciais.length,
        processamento_background: dadosValidados.length,
        mensagem: `${dadosValidados.length} preços serão processados em background. ${errosIniciais.length} erros de validação inicial.`
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