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
    const BATCH_SIZE = 100 // Processar em lotes de 100

    // 4. Processar em lotes para otimizar performance
    for (let batchStart = 1; batchStart < jsonData.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, jsonData.length)
      const batchData: any[] = []
      
      console.log(`Processando lote ${Math.floor(batchStart / BATCH_SIZE) + 1}: linhas ${batchStart} a ${batchEnd - 1}`)
      
      for (let i = batchStart; i < batchEnd; i++) {
        try {
          const row = jsonData[i] as any[]
          
          if (!row || row.length < headers.length) {
            console.log(`Linha ${i + 1} ignorada - dados insuficientes`)
            continue
          }

          // Mapear campos do Excel (procurar por diferentes variações de nomes)
          const clienteIdx = headers.findIndex(h => 
            h && (h.toLowerCase().includes('cliente') || h.toLowerCase().includes('client'))
          )
          const modalidadeIdx = headers.findIndex(h => 
            h && h.toLowerCase().includes('modalidade')
          )
          const especialidadeIdx = headers.findIndex(h => 
            h && h.toLowerCase().includes('especialidade')
          )
          const categoriaIdx = headers.findIndex(h => 
            h && h.toLowerCase().includes('categoria')
          )
          const prioridadeIdx = headers.findIndex(h => 
            h && h.toLowerCase().includes('prioridade')
          )
          const valorIdx = headers.findIndex(h => 
            h && h.toLowerCase().includes('valor')
          )

          const cliente = row[clienteIdx] || row[0]
          const modalidade = row[modalidadeIdx] || row[1]
          const especialidade = row[especialidadeIdx] || row[2]
          const categoria = row[categoriaIdx] || row[3] || 'Normal'
          const prioridade = row[prioridadeIdx] || row[4] || 'Rotina'
          const valorStr = row[valorIdx] || row[5]

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
          
          if (isNaN(valor)) {
            erros.push(`Linha ${i + 1}: valor inválido - ${valorStr}`)
            registrosErro++
            continue
          }

          // Buscar cliente_id pelo nome
          const { data: clienteData, error: clienteError } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('nome', String(cliente).trim())
            .single()

          if (clienteError || !clienteData) {
            erros.push(`Linha ${i + 1}: Cliente "${cliente}" não encontrado`)
            registrosErro++
            continue
          }

          batchData.push({
            cliente_id: clienteData.id,
            modalidade: String(modalidade).trim(),
            especialidade: String(especialidade).trim(),
            categoria: String(categoria).trim(),
            prioridade: String(prioridade).trim(),
            valor: valor,
            ativo: true
          })

        } catch (error) {
          erros.push(`Linha ${i + 1}: ${error.message}`)
          registrosErro++
        }
      }

      // Inserir lote no banco
      if (batchData.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .upsert(batchData, {
            onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
          })

        if (insertError) {
          console.error('Erro ao inserir lote:', insertError.message)
          erros.push(`Erro no lote: ${insertError.message}`)
          registrosErro += batchData.length
        } else {
          registrosProcessados += batchData.length
        }
      }

      // Log de progresso
      console.log(`Lote processado: ${registrosProcessados} sucessos, ${registrosErro} erros`)
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