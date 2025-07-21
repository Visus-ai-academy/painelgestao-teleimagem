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
    console.log('Cabeçalhos detectados:', Object.keys(jsonData[0] || {}))
    
    // Buscar mapeamentos de campo do template
    const { data: mappings, error: mappingError } = await supabaseClient
      .from('field_mappings')
      .select('source_field, target_field')
      .eq('template_name', 'MobileMed - Clientes')
      .eq('file_type', 'clientes')
      .eq('active', true)
      .order('order_index')

    if (mappingError) {
      console.log('Erro ao buscar mapeamentos:', mappingError)
      throw new Error('Erro ao buscar configuração de mapeamento')
    }

    console.log('Mapeamentos encontrados:', JSON.stringify(mappings, null, 2))

    // Criar mapa de campos automaticamente (source -> target)
    const sourceToTargetMap: Record<string, string> = {}
    mappings?.forEach((mapping: any) => {
      sourceToTargetMap[mapping.source_field] = mapping.target_field
    })

    console.log('Mapa source->target:', JSON.stringify(sourceToTargetMap, null, 2))

    // Versão simplificada para debug - usar campos diretos do arquivo
    console.log('=== PROCESSAMENTO SIMPLIFICADO ===')
    const clientes = jsonData.map((row: any, index: number) => {
      if (index < 3) {
        console.log(`Linha ${index}:`, JSON.stringify(row, null, 2))
      }
      
      // Usar nomes diretos dos campos do arquivo
      const nome = row['Cliente (Nome Fantasia)'] || '';
      const email = row['e-mail'] || '';
      const telefone = row['contato'] || null;
      const endereco = row['endereco'] || null;
      const cnpj = row['CNPJ/CPF'] || null;
      const status = row['Status'] || 'A';
      
      // Transform status codes
      let ativo = true;
      if (status === 'I' || status === 'C') {
        ativo = false;
      }
      
      const cliente = {
        nome: String(nome).trim(),
        email: String(email).trim(),
        telefone: telefone,
        endereco: endereco,
        cnpj: cnpj,
        ativo: ativo
      };
      
      if (index < 3) {
        console.log(`Cliente ${index} processado:`, JSON.stringify(cliente, null, 2))
      }
      
      return cliente;
    })

    console.log('Total de clientes mapeados:', clientes.length)

    // Filter valid clients
    const clientesValidos = clientes.filter(cliente => 
      cliente.nome && cliente.nome.trim() !== '' && cliente.nome !== 'undefined'
    )

    console.log('Clientes válidos (com nome preenchido):', clientesValidos.length)
    
    // Log dos clientes inválidos para debug
    const clientesInvalidos = clientes.filter(cliente => 
      !cliente.nome || cliente.nome.trim() === '' || cliente.nome === 'undefined'
    )
    if (clientesInvalidos.length > 0) {
      console.log('Clientes inválidos encontrados:', clientesInvalidos.length)
      console.log('Exemplos de clientes inválidos:', JSON.stringify(clientesInvalidos.slice(0, 3), null, 2))
    }

    // Remove duplicates based on nome + email combination
    const clientesUnicos = clientesValidos.reduce((acc: any[], cliente: any) => {
      const key = `${cliente.nome}_${cliente.email || 'sem_email'}`
      const exists = acc.some(c => `${c.nome}_${c.email || 'sem_email'}` === key)
      if (!exists) {
        acc.push(cliente)
      }
      return acc
    }, [])

    const duplicatasRemovidas = clientesValidos.length - clientesUnicos.length
    console.log('Clientes únicos após remoção de duplicatas:', clientesUnicos.length)
    console.log('Duplicatas removidas:', duplicatasRemovidas)

    // Clear existing clients - limpar TODOS os clientes (sem triggers)
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

    // Insert new clients directly without any triggers
    console.log('Inserindo clientes processados:', clientesUnicos.length)
    const { data: clientesInseridos, error: clientesError } = await supabaseClient
      .from('clientes')
      .insert(clientesUnicos)
      .select()

    if (clientesError) {
      console.error('Erro detalhado ao inserir clientes:', clientesError)
      throw new Error(`Erro ao inserir clientes: ${clientesError.message}`)
    }

    console.log('Clientes inseridos com sucesso:', clientesInseridos?.length || 0)

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