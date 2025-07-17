import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'

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

    // 2. Baixar arquivo do storage
    console.log('Baixando arquivo do storage...')
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    // 3. Converter arquivo para buffer
    const buffer = await fileData.arrayBuffer()
    
    // 4. Processar arquivo Excel/CSV
    console.log('Analisando formato do arquivo...')
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    console.log('Dados encontrados:', jsonData.length, 'registros')

    // 5. Mapear dados para estrutura do banco
    const exames = jsonData.map((row: any) => ({
      id: crypto.randomUUID(),
      paciente: row.paciente || row.Paciente || row.PACIENTE || '',
      medico: row.medico || row.Medico || row.MEDICO || '',
      data_exame: row.data_exame || row.Data_Exame || row.DATA_EXAME || new Date().toISOString().split('T')[0],
      modalidade: row.modalidade || row.Modalidade || row.MODALIDADE || '',
      especialidade: row.especialidade || row.Especialidade || row.ESPECIALIDADE || '',
      categoria: row.categoria || row.Categoria || row.CATEGORIA || null,
      prioridade: row.prioridade || row.Prioridade || row.PRIORIDADE || null,
      status: 'realizado',
      valor_bruto: parseFloat(row.valor_bruto || row.Valor_Bruto || row.VALOR_BRUTO || 0) || null,
      cliente_id: null // Será necessário mapear com os clientes existentes
    }))

    // 6. Filtrar apenas exames com campos obrigatórios válidos
    const examesValidos = exames.filter(exame => 
      exame.paciente && exame.paciente.trim() !== '' &&
      exame.medico && exame.medico.trim() !== '' &&
      exame.modalidade && exame.modalidade.trim() !== '' &&
      exame.especialidade && exame.especialidade.trim() !== ''
    )

    console.log('Inserindo exames no banco...', examesValidos.length, 'registros')

    // 7. Inserir dados no banco
    const { data: examesInseridos, error: examesError } = await supabaseClient
      .from('exames_realizados')
      .insert(examesValidos)
      .select()

    if (examesError) {
      throw new Error(`Erro ao inserir exames: ${examesError.message}`)
    }

    // 8. Atualizar log com sucesso
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: examesValidos.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError.message)
    }

    console.log(`Processamento concluído! ${examesValidos.length} exames inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: examesValidos.length,
        registros_erro: jsonData.length - examesValidos.length,
        mensagem: `${examesValidos.length} exames processados com sucesso`
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