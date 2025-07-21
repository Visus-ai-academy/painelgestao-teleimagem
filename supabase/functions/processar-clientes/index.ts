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
    console.log('Cabeçalhos disponíveis:', Object.keys(jsonData[0] || {}))

    if (jsonData.length === 0) {
      throw new Error('Arquivo vazio')
    }

    // Buscar mapeamentos de campo do template
    console.log('=== BUSCANDO MAPEAMENTOS ===')
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

    // Map data using dynamic field mappings automatically
    console.log('=== MAPEANDO DADOS ===')
    const clientes = jsonData.map((row: any, index: number) => {
      const clienteData: any = {}
      
      // LOG DETALHADO DOS DADOS BRUTOS
      if (index < 3) {
        console.log(`=== LINHA ${index} RAW ===`)
        console.log('Dados brutos da linha:', JSON.stringify(row, null, 2))
        console.log('Campos disponíveis:', Object.keys(row))
      }
      
      // Processar cada campo do arquivo usando os mapeamentos
      Object.keys(row).forEach(sourceField => {
        const targetField = sourceToTargetMap[sourceField]
        if (targetField) {
          clienteData[targetField] = row[sourceField]
          if (index < 3) {
            console.log(`Mapeamento: "${sourceField}" -> "${targetField}" = "${row[sourceField]}"`)
          }
        } else {
          if (index < 3) {
            console.log(`Campo não mapeado: "${sourceField}" = "${row[sourceField]}"`)
          }
        }
      })
      
      if (index < 3) {
        console.log(`Cliente ${index} após mapeamento:`, JSON.stringify(clienteData, null, 2))
      }
      
      // Campos obrigatórios mapeados dinamicamente
      const nome = clienteData.nome || '';
      const email = clienteData.email || '';
      const telefone = clienteData.telefone || null;
      const endereco = clienteData.endereco || null;
      const cnpj = clienteData.cnpj || null;
      const status = clienteData.Status || 'A'; // Padrão: Ativo
      
      if (index < 3) {
        console.log(`Campos extraídos - Nome: "${nome}", Email: "${email}", Status: "${status}"`)
      }
      
      // Transform status codes: I = Inativo (false), A = Ativo (true), C = Cancelado (false)
      let ativo = true; // Padrão
      if (status === 'I' || status === 'C') {
        ativo = false;
      } else if (status === 'A') {
        ativo = true;
      }
      
      const clienteFinal = {
        nome: String(nome).trim(),
        email: String(email).trim(),
        telefone: telefone,
        endereco: endereco,
        cnpj: cnpj,
        contato: clienteData.contato || null,
        cod_cliente: clienteData.cod_cliente || null,
        data_inicio_contrato: clienteData.data_inicio_contrato || null,
        data_termino_vigencia: clienteData.data_termino_vigencia || null,
        ativo: ativo
      };
      
      if (index < 3) {
        console.log(`Cliente ${index} FINAL:`, JSON.stringify(clienteFinal, null, 2))
      }
      
      return clienteFinal;
    }).filter((cliente, index) => {
      const valido = cliente.nome && cliente.nome.trim() !== '' && cliente.nome !== 'undefined' && cliente.nome.toLowerCase() !== 'null'
      if (index < 5) {
        console.log(`Cliente ${index} válido: ${valido}, nome: "${cliente.nome}"`)
      }
      return valido
    })

    console.log('Clientes válidos:', clientes.length)
    if (clientes.length > 0) {
      console.log('Primeiro cliente processado:', JSON.stringify(clientes[0], null, 2))
    }

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