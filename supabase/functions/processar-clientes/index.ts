import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== INICIANDO PROCESSAR-CLIENTES ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let logEntry: any = null;

    console.log('=== RECEBENDO DADOS ===')
    const { fileName } = await req.json()
    console.log('Arquivo recebido:', fileName)

    // Create log
    console.log('=== CRIANDO LOG ===')
    const { data: logData, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'clientes',
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      console.log('Erro ao criar log:', logError)
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }
    
    logEntry = logData;
    console.log('Log criado com ID:', logEntry.id)

    // Download file
    console.log('=== BAIXANDO ARQUIVO ===')
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      console.log('Erro ao baixar arquivo:', downloadError)
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    console.log('Arquivo baixado, tamanho:', fileData.size, 'bytes')

    // Process file
    console.log('=== PROCESSANDO EXCEL ===')
    const buffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    console.log('Dados extraídos do Excel:', jsonData.length, 'linhas')
    console.log('Primeira linha de exemplo:', JSON.stringify(jsonData[0], null, 2))

    if (jsonData.length === 0) {
      throw new Error('Arquivo vazio')
    }

    // Simple mapping - usar campos diretos
    console.log('=== MAPEANDO DADOS ===')
    const clientes = jsonData.map((row: any, index: number) => {
      const nome = row['Cliente (Nome Fantasia)'] || '';
      const email = row['e-mail'] || '';
      
      if (index < 3) {
        console.log(`Linha ${index} - Nome: "${nome}", Email: "${email}"`)
      }
      
      return {
        nome: String(nome).trim(),
        email: String(email).trim(),
        telefone: row['contato'] || null,
        endereco: row['endereco'] || null,
        cnpj: row['CNPJ/CPF'] || null,
        ativo: true
      };
    }).filter((cliente, index) => {
      const valido = cliente.nome && cliente.nome.trim() !== '' && cliente.nome !== 'undefined'
      if (index < 5) {
        console.log(`Cliente ${index} válido: ${valido}, nome: "${cliente.nome}"`)
      }
      return valido
    })

    console.log('Clientes válidos:', clientes.length)
    console.log('Primeiro cliente:', JSON.stringify(clientes[0], null, 2))

    // Clear existing clients
    console.log('=== LIMPANDO CLIENTES EXISTENTES ===')
    const { error: deleteError } = await supabaseClient
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      console.log('Erro ao limpar clientes:', deleteError)
      throw new Error(`Erro ao limpar clientes: ${deleteError.message}`)
    }

    console.log('Clientes existentes removidos')

    // Insert new clients
    console.log('=== INSERINDO NOVOS CLIENTES ===')
    const { data: insertData, error: insertError } = await supabaseClient
      .from('clientes')
      .insert(clientes)
      .select()

    if (insertError) {
      console.log('Erro ao inserir clientes:', insertError)
      throw new Error(`Erro ao inserir clientes: ${insertError.message}`)
    }

    console.log('Clientes inseridos com sucesso:', insertData?.length || 0)

    // Update log
    await supabaseClient
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: clientes.length
      })
      .eq('id', logEntry.id)

    console.log('Processamento concluído:', clientes.length, 'clientes')

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: clientes.length,
        registros_duplicados: 0,
        mensagem: `${clientes.length} clientes processados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.log('ERRO:', error.message)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  }
})