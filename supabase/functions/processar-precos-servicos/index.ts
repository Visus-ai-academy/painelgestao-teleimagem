import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    console.log('Processando arquivo de preços de serviços:', file.name)

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

    // 2. Ler e processar arquivo CSV
    const csvText = await file.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    
    if (lines.length <= 1) {
      throw new Error('Arquivo CSV vazio ou sem dados')
    }

    // 3. Processar header e dados
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('Headers encontrados:', headers)

    let registrosProcessados = 0
    let registrosErro = 0
    const erros: string[] = []

    // 4. Processar cada linha do CSV
    for (let i = 1; i < lines.length; i++) {
      try {
        const valores = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        
        if (valores.length < headers.length) {
          console.log(`Linha ${i + 1} ignorada - poucos campos`)
          continue
        }

        // Mapear campos do CSV
        const cliente = valores[headers.indexOf('cliente')] || valores[headers.indexOf('Cliente')] || valores[0]
        const modalidade = valores[headers.indexOf('modalidade')] || valores[headers.indexOf('Modalidade')] || valores[1]
        const especialidade = valores[headers.indexOf('especialidade')] || valores[headers.indexOf('Especialidade')] || valores[2]
        const categoria = valores[headers.indexOf('categoria')] || valores[headers.indexOf('Categoria')] || valores[3]
        const prioridade = valores[headers.indexOf('prioridade')] || valores[headers.indexOf('Prioridade')] || valores[4]
        const valorStr = valores[headers.indexOf('valor')] || valores[headers.indexOf('Valor')] || valores[5]

        // Validações básicas
        if (!cliente || !modalidade || !especialidade || !valorStr) {
          erros.push(`Linha ${i + 1}: campos obrigatórios faltando`)
          registrosErro++
          continue
        }

        // Converter valor
        const valor = parseFloat(valorStr.replace(/[R$\s]/g, '').replace(',', '.'))
        if (isNaN(valor)) {
          erros.push(`Linha ${i + 1}: valor inválido - ${valorStr}`)
          registrosErro++
          continue
        }

        // Buscar cliente_id pelo nome
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from('clientes')
          .select('id')
          .eq('nome', cliente)
          .single()

        if (clienteError || !clienteData) {
          erros.push(`Linha ${i + 1}: Cliente "${cliente}" não encontrado`)
          registrosErro++
          continue
        }

        // Inserir preço de serviço
        const { error: insertError } = await supabaseClient
          .from('precos_servicos')
          .upsert({
            cliente_id: clienteData.id,
            modalidade: modalidade,
            especialidade: especialidade,
            categoria: categoria || 'Normal',
            prioridade: prioridade || 'Rotina',
            valor: valor,
            ativo: true
          }, {
            onConflict: 'cliente_id,modalidade,especialidade,categoria,prioridade'
          })

        if (insertError) {
          erros.push(`Linha ${i + 1}: Erro ao inserir - ${insertError.message}`)
          registrosErro++
          continue
        }

        registrosProcessados++
        
        // Log de progresso a cada 50 registros
        if (registrosProcessados % 50 === 0) {
          console.log(`Processados ${registrosProcessados} registros...`)
        }

      } catch (error) {
        erros.push(`Linha ${i + 1}: ${error.message}`)
        registrosErro++
      }
    }

    // 5. Atualizar flags nos contratos dos clientes que tiveram preços configurados
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
        error_details: erros.length > 0 ? erros.slice(0, 10).join('; ') : null
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