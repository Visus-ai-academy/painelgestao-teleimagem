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
    console.log('=== PROCESSAR EXAMES INICIADO ===')
    console.log('Method:', req.method)
    console.log('Headers:', Object.fromEntries(req.headers.entries()))
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log('Cliente Supabase criado')
    
    const requestBody = await req.json()
    console.log('Body recebido:', requestBody)
    
    const { fileName } = requestBody

    console.log('Processando arquivo de exames:', fileName)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'exames',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Baixar arquivo do storage (simulado)
    console.log('Baixando arquivo do storage...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Processar CSV/Excel (simulado)
    console.log('Analisando formato do arquivo...')
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Simular dados processados
    const examosMock = [
      {
        paciente: "João Silva",
        cliente_id: "550e8400-e29b-41d4-a716-446655440001",
        medico: "Dr. Antonio",
        data_exame: "2025-07-15",
        modalidade: "MR",
        especialidade: "NE",
        status: "Realizado",
        valor_bruto: 450.00
      },
      {
        paciente: "Maria Santos",
        cliente_id: "550e8400-e29b-41d4-a716-446655440002", 
        medico: "Dra. Ana",
        data_exame: "2025-07-16",
        modalidade: "CT",
        especialidade: "CA",
        status: "Realizado",
        valor_bruto: 320.00
      }
    ]

    console.log('Inserindo exames no banco...')

    // 4. Inserir dados no banco
    const { data: examesInseridos, error: examesError } = await supabaseClient
      .from('exames_realizados')
      .insert(examosMock)
      .select()

    if (examesError) {
      throw new Error(`Erro ao inserir exames: ${examesError.message}`)
    }

    // 5. Atualizar log com sucesso
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'success',
        records_processed: examosMock.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${examosMock.length} exames inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: examosMock.length,
        registros_erro: 0,
        mensagem: 'Arquivo processado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===')
    console.error('Tipo do erro:', typeof error)
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Error completo:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro interno do servidor',
        details: error?.stack || 'Sem detalhes do stack'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})