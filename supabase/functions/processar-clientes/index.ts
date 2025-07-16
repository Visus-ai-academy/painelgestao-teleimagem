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

    console.log('Processando arquivo de clientes:', fileName)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'clientes',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }

    // 2. Processar dados dos clientes (simulado por enquanto)
    console.log('Processando dados dos clientes...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Dados simulados de clientes com UUIDs específicos
    const clientesMock = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        nome: "Hospital São Lucas",
        email: "contato@saolucas.com.br",
        telefone: "(11) 3456-7890",
        endereco: "Rua das Flores, 123 - São Paulo/SP",
        cnpj: "12.345.678/0001-90",
        ativo: true
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        nome: "Clínica Vida Plena",
        email: "admin@vidaplena.com.br",
        telefone: "(11) 2345-6789",
        endereco: "Av. Paulista, 456 - São Paulo/SP",
        cnpj: "98.765.432/0001-10",
        ativo: true
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        nome: "Centro Médico Norte",
        email: "faturamento@centronorte.com.br",
        telefone: "(11) 4567-8901",
        endereco: "Rua Norte, 789 - São Paulo/SP",
        cnpj: "11.222.333/0001-44",
        ativo: true
      }
    ]

    console.log('Inserindo clientes no banco...')

    // 3. Inserir/Atualizar clientes (upsert)
    const { data: clientesInseridos, error: clientesError } = await supabaseClient
      .from('clientes')
      .upsert(clientesMock, { onConflict: 'id' })
      .select()

    if (clientesError) {
      throw new Error(`Erro ao inserir clientes: ${clientesError.message}`)
    }

    // 4. Atualizar log com sucesso
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'success',
        records_processed: clientesMock.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${clientesMock.length} clientes inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: clientesMock.length,
        registros_erro: 0,
        mensagem: 'Clientes processados com sucesso'
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