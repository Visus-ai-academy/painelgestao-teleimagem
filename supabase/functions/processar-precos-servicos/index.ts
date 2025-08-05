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

    let registrosProcessados = 0
    let registrosErro = 0
    const erros: string[] = []

    // 3. Processar dados linha por linha (método simples)
    for (let i = 1; i < Math.min(jsonData.length, 101); i++) { // Processar apenas 100 primeiras linhas para teste
      try {
        const row = jsonData[i] as any[]
        
        if (!row || row.length < 3) {
          console.log(`⚠️ Linha ${i}: dados insuficientes`)
          continue
        }

        // Mapear campos de forma direta (assumindo ordem padrão)
        const cliente = String(row[0] || '').trim()
        const modalidade = String(row[1] || '').trim()
        const especialidade = String(row[2] || '').trim()
        const valor = parseFloat(String(row[3] || row[4] || row[5] || '0').replace(/[^\d,.-]/g, '').replace(',', '.'))

        console.log(`📝 Linha ${i}: "${cliente}" | "${modalidade}" | "${especialidade}" | ${valor}`)

        // Validar dados essenciais
        if (!cliente || cliente.length < 2) {
          erros.push(`Linha ${i}: Cliente inválido`)
          registrosErro++
          continue
        }

        if (!modalidade || modalidade.length < 1) {
          erros.push(`Linha ${i}: Modalidade inválida`)
          registrosErro++
          continue
        }

        if (!especialidade || especialidade.length < 1) {
          erros.push(`Linha ${i}: Especialidade inválida`)
          registrosErro++
          continue
        }

        if (isNaN(valor) || valor <= 0) {
          erros.push(`Linha ${i}: Valor inválido - ${valor}`)
          registrosErro++
          continue
        }

        // Buscar cliente no banco
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from('clientes')
          .select('id')
          .ilike('nome', `%${cliente}%`)
          .limit(1)
          .single()

        if (clienteError || !clienteData) {
          erros.push(`Linha ${i}: Cliente "${cliente}" não encontrado`)
          registrosErro++
          continue
        }

        // Inserir preço
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .upsert({
            cliente_id: clienteData.id,
            modalidade: modalidade,
            especialidade: especialidade,
            categoria: 'Normal',
            prioridade: 'Rotina',
            valor: valor,
            ativo: true
          }, {
            onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
          })

        if (insertError) {
          erros.push(`Linha ${i}: Erro ao inserir - ${insertError.message}`)
          registrosErro++
          continue
        }

        registrosProcessados++
        
        if (registrosProcessados % 10 === 0) {
          console.log(`✅ Processados: ${registrosProcessados}, Erros: ${registrosErro}`)
        }

      } catch (error) {
        erros.push(`Linha ${i}: ${error.message}`)
        registrosErro++
      }
    }

    // 4. Atualizar contratos
    console.log('🔄 Atualizando status dos contratos...')
    const { error: updateError } = await supabaseClient
      .rpc('atualizar_status_configuracao_contrato')

    if (updateError) {
      console.error('❌ Erro ao atualizar contratos:', updateError.message)
    }

    // 5. Finalizar log
    const status = registrosErro > registrosProcessados ? 'failed' : 'success'
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: status,
        records_processed: registrosProcessados,
        error_count: registrosErro,
        error_details: erros.slice(0, 10).join('; ')
      })
      .eq('id', logEntry.id)

    console.log(`🎉 Processamento concluído: ${registrosProcessados} sucessos, ${registrosErro} erros`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: registrosProcessados,
        registros_erro: registrosErro,
        erros: erros.slice(0, 10),
        mensagem: `Processados ${registrosProcessados} preços de serviços`
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