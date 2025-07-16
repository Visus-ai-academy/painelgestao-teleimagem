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

    console.log('Processando arquivo de exames:', fileName)

    // 1. Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        arquivo_nome: fileName,
        tipo_arquivo: 'exames',
        tamanho_bytes: 0, // Será atualizado
        status: 'Processando'
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
        cliente_id: "cliente-1",
        medico: "Dr. Antonio",
        data_exame: "2024-01-15",
        modalidade: "MR",
        especialidade: "NE",
        status: "Realizado"
      },
      {
        paciente: "Maria Santos",
        cliente_id: "cliente-1", 
        medico: "Dra. Ana",
        data_exame: "2024-01-16",
        modalidade: "CT",
        especialidade: "CA",
        status: "Realizado"
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
        status: 'Concluído',
        registros_processados: examosMock.length,
        registros_erro: 0
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