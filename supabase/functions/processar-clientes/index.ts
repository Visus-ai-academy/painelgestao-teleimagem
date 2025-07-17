import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== INICIANDO PROCESSAR-CLIENTES ===')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Método da requisição:', req.method)
    console.log('Headers:', Object.fromEntries(req.headers.entries()))

    // Create Supabase client
    console.log('Criando cliente Supabase...')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )
    console.log('Cliente Supabase criado com sucesso')

    // Parse request body
    console.log('Fazendo parse do body...')
    const requestBody = await req.json()
    console.log('Body recebido:', requestBody)
    
    const { fileName } = requestBody
    if (!fileName) {
      throw new Error('Nome do arquivo não fornecido')
    }
    console.log('Nome do arquivo:', fileName)

    // Create upload log
    console.log('Criando log de upload...')
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
      console.error('Erro ao criar log:', logError)
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }
    console.log('Log criado:', logEntry.id)

    // Download file from storage
    console.log('Baixando arquivo do storage...')
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      console.error('Erro ao baixar arquivo:', downloadError)
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }
    console.log('Arquivo baixado com sucesso, tamanho:', fileData.size)

    // Convert to buffer and process
    console.log('Convertendo para buffer...')
    const buffer = await fileData.arrayBuffer()
    console.log('Buffer criado, tamanho:', buffer.byteLength)
    
    // Parse Excel/CSV file
    console.log('Processando arquivo Excel/CSV...')
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    console.log('Nome da planilha:', sheetName)
    
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    console.log('Dados convertidos para JSON:', jsonData.length, 'registros')
    
    if (jsonData.length > 0) {
      console.log('Primeira linha exemplo:', JSON.stringify(jsonData[0]))
    }

    // Map data to database structure
    console.log('Mapeando dados para estrutura do banco...')
    const clientes = jsonData.map((row: any) => {
      const nome = row.nome || row.Nome || row.NOME || row.cliente || row.Cliente || '';
      const email = row.email || row.Email || row.EMAIL || '';
      
      return {
        nome: String(nome).trim(),
        email: String(email).trim(),
        telefone: row.telefone || row.Telefone || null,
        endereco: row.endereco || row.Endereco || null,
        cnpj: row.cnpj || row.CNPJ || null,
        ativo: true
      };
    })

    // Filter valid clients
    const clientesValidos = clientes.filter(cliente => 
      cliente.nome && cliente.nome.trim() !== '' && cliente.nome !== 'undefined'
    )
    console.log('Clientes válidos filtrados:', clientesValidos.length)

    // Clear existing clients
    console.log('Limpando clientes existentes...')
    const { error: deleteError } = await supabaseClient
      .from('clientes')
      .delete()
      .neq('id', 'never-match')

    if (deleteError) {
      console.warn('Aviso ao limpar dados:', deleteError.message)
    } else {
      console.log('Clientes existentes removidos')
    }

    // Insert new clients
    console.log('Inserindo novos clientes...')
    const { data: clientesInseridos, error: clientesError } = await supabaseClient
      .from('clientes')
      .insert(clientesValidos)
      .select()

    if (clientesError) {
      console.error('Erro ao inserir clientes:', clientesError)
      throw new Error(`Erro ao inserir clientes: ${clientesError.message}`)
    }
    console.log('Clientes inseridos com sucesso:', clientesInseridos?.length)

    // Update log
    console.log('Atualizando log...')
    const { error: updateLogError } = await supabaseClient
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: clientesValidos.length
      })
      .eq('id', logEntry.id)

    if (updateLogError) {
      console.error('Erro ao atualizar log:', updateLogError)
    }

    console.log('=== PROCESSAMENTO CONCLUÍDO COM SUCESSO ===')
    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: clientesValidos.length,
        mensagem: `${clientesValidos.length} clientes processados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===')
    console.error('Erro:', error.message)
    console.error('Stack:', error.stack)

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