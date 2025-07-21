import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== INICIANDO PROCESSAR-CLIENTES ===')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let supabaseClient: any;
  let logEntry: any = null;
  
  try {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { fileName } = await req.json()
    console.log('Processando arquivo:', fileName)

    // Create log
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
      throw new Error(`Erro ao criar log: ${logError.message}`)
    }
    
    logEntry = logData;

    // Download file
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    // Process file
    const buffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    console.log('Dados encontrados:', jsonData.length, 'registros')
    console.log('Primeiras 3 linhas dos dados:', JSON.stringify(jsonData.slice(0, 3), null, 2))
    
    if (jsonData.length === 0) {
      console.log('ERRO: Arquivo está vazio ou não foi possível extrair dados')
      throw new Error('Arquivo vazio ou formato inválido')
    }

    // Map data
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

    console.log('Clientes válidos:', clientesValidos.length)

    // Remove duplicates based on nome + email combination
    const clientesUnicos = clientesValidos.reduce((acc: any[], cliente: any) => {
      const key = `${cliente.nome}_${cliente.email || 'sem_email'}`
      const exists = acc.some(c => `${c.nome}_${c.email || 'sem_email'}` === key)
      if (!exists) {
        acc.push(cliente)
      }
      return acc
    }, [])

    console.log('Clientes únicos após remoção de duplicatas:', clientesUnicos.length)

    // Clear existing clients - limpar TODOS os clientes
    console.log('Limpando clientes existentes...')
    const { error: deleteError } = await supabaseClient
      .from('clientes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // delete all records
    
    if (deleteError) {
      console.warn('Aviso ao limpar clientes:', deleteError)
    } else {
      console.log('Todos os clientes foram removidos da base')
    }

    // Insert new clients
    const { data: clientesInseridos, error: clientesError } = await supabaseClient
      .from('clientes')
      .insert(clientesUnicos)
      .select()

    if (clientesError) {
      throw new Error(`Erro ao inserir clientes: ${clientesError.message}`)
    }

    // Update log
    await supabaseClient
      .from('upload_logs')
      .update({
        status: 'completed',
        records_processed: clientesUnicos.length
      })
      .eq('id', logEntry.id)

    console.log('Processamento concluído:', clientesUnicos.length, 'clientes')

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: clientesUnicos.length,
        registros_duplicados: clientesValidos.length - clientesUnicos.length,
        mensagem: `${clientesUnicos.length} clientes processados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro no processamento:', error.message)

    // Update log with error
    if (logEntry && supabaseClient) {
      try {
        await supabaseClient
          .from('upload_logs')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('id', logEntry.id)
      } catch (logUpdateError) {
        console.error('Erro ao atualizar log:', logUpdateError)
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})