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

    const { fileName } = await req.json()

    console.log('Processando arquivo de contratos:', fileName)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'contratos',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Processar dados dos contratos (simulado por enquanto)
    console.log('Processando dados dos contratos...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Dados simulados de contratos
    const contratosMock = [
      {
        cliente_id: "550e8400-e29b-41d4-a716-446655440001",
        modalidade: "MR",
        especialidade: "NE",
        categoria: "Normal",
        prioridade: "Urgente",
        valor: 450.00,
        desconto: 0,
        acrescimo: 50.00,
        data_vigencia_inicio: "2025-01-01",
        data_vigencia_fim: "2025-12-31",
        ativo: true
      },
      {
        cliente_id: "550e8400-e29b-41d4-a716-446655440001",
        modalidade: "CT",
        especialidade: "CA",
        categoria: "Normal",
        prioridade: "Rotina",
        valor: 320.00,
        desconto: 10.00,
        acrescimo: 0,
        data_vigencia_inicio: "2025-01-01",
        data_vigencia_fim: "2025-12-31",
        ativo: true
      },
      {
        cliente_id: "550e8400-e29b-41d4-a716-446655440002",
        modalidade: "US",
        especialidade: "OB",
        categoria: "Especial",
        prioridade: "Urgente",
        valor: 280.00,
        desconto: 0,
        acrescimo: 30.00,
        data_vigencia_inicio: "2025-01-01",
        data_vigencia_fim: "2025-12-31",
        ativo: true
      }
    ]

    console.log('Inserindo contratos no banco...')

    // 3. Inserir contratos - SEMPRE INSERT, permitir duplicados
    const { data: contratosInseridos, error: contratosError } = await supabaseClient
      .from('contratos_clientes')
      .insert(contratosMock)
      .select()

    if (contratosError) {
      throw new Error(`Erro ao inserir contratos: ${contratosError.message}`)
    }

    // 4. Atualizar log com sucesso
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'success',
        records_processed: contratosMock.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${contratosMock.length} contratos inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: contratosMock.length,
        registros_erro: 0,
        mensagem: 'Contratos processados com sucesso'
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