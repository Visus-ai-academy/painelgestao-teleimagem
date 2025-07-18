import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import { read, utils } from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO ===')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  let logData: any = null;
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const fileName = body?.fileName
    
    if (!fileName) {
      throw new Error('Nome do arquivo é obrigatório')
    }
    
    console.log('Processando arquivo:', fileName)

    // Criar log de upload
    const { data: logResult, error: logError } = await supabase
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'faturamento',
        status: 'processing'
      })
      .select()
      .single()

    logData = logResult;

    if (logError) {
      console.error('Erro ao criar log:', logError)
      throw new Error('Erro ao criar log de upload')
    }

    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      console.error('Erro ao baixar arquivo:', downloadError)
      throw new Error('Erro ao baixar arquivo')
    }

    if (!fileData) {
      throw new Error('Arquivo não encontrado no storage')
    }

    // Converter para ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer()
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Arquivo vazio ou corrompido')
    }
    
    // Ler arquivo Excel
    console.log('Lendo arquivo Excel...')
    const workbook = read(arrayBuffer)
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Planilha não encontrada no arquivo')
    }
    
    console.log('Planilhas encontradas:', workbook.SheetNames)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    
    // Usar range para limitar a quantidade de dados processados
    const jsonData = utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      range: 'A1:Z1000' // Limitar a 1000 linhas para evitar problemas de memória
    })

    console.log('Dados extraídos:', jsonData?.length || 0, 'registros')
    
    if (!jsonData || jsonData.length === 0) {
      throw new Error('Nenhum dado encontrado no arquivo')
    }
    
    // Primeira linha como cabeçalho
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1).filter(row => Array.isArray(row) && row.some(cell => cell && cell.toString().trim() !== ''))
    
    console.log('Cabeçalhos encontrados:', headers)
    console.log('Linhas de dados:', dataRows.length)

    // Processar dados com mapeamento mais flexível
    const faturamentoData = dataRows.map((row: any[], index: number) => {
      // Converter array em objeto usando os cabeçalhos
      const rowData: any = {}
      headers.forEach((header, idx) => {
        if (header && row[idx] !== undefined) {
          rowData[header.toString().trim()] = row[idx]
        }
      })

      // Buscar as colunas por diferentes variações de nomes
      const getColumnValue = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const value = rowData[name]
          if (value !== undefined && value !== null && value.toString().trim() !== '') {
            return value.toString().trim()
          }
        }
        return ''
      }

      const clienteNome = getColumnValue(['Cliente', 'cliente_nome', 'ClienteNome', 'Nome Cliente', 'nome_cliente'])
      
      // Só processar se tiver nome do cliente
      if (!clienteNome) {
        return null
      }

      return {
        omie_id: getColumnValue(['ID', 'id', 'omie_id', 'Id']) || `FAT_${Date.now()}_${index}`,
        numero_fatura: getColumnValue(['Número da Fatura', 'numero_fatura', 'NumeroFatura', 'Numero', 'numero']) || `NF_${Date.now()}_${index}`,
        cliente_nome: clienteNome,
        cliente_email: getColumnValue(['Email', 'cliente_email', 'ClienteEmail', 'E-mail', 'email']),
        data_emissao: getColumnValue(['Data de Emissão', 'data_emissao', 'DataEmissao', 'Emissão', 'emissao']) || new Date().toISOString().split('T')[0],
        data_vencimento: getColumnValue(['Data de Vencimento', 'data_vencimento', 'DataVencimento', 'Vencimento', 'vencimento']) || getColumnValue(['Data de Emissão', 'data_emissao', 'DataEmissao', 'Emissão', 'emissao']) || new Date().toISOString().split('T')[0],
        data_pagamento: getColumnValue(['Data de Pagamento', 'data_pagamento', 'DataPagamento', 'Pagamento', 'pagamento']) || null,
        valor: parseFloat(getColumnValue(['Valor', 'valor', 'ValorTotal', 'Total', 'total']) || '0'),
        status: getColumnValue(['Status', 'status', 'Situação', 'situacao']) || 'pendente'
      }
    }).filter(item => item !== null)

    console.log('Dados processados:', faturamentoData.length, 'registros válidos')

    if (faturamentoData.length === 0) {
      throw new Error('Nenhum registro válido encontrado no arquivo')
    }

    // Inserir dados em lotes para evitar problemas de memória
    const batchSize = 100
    let totalInserted = 0

    for (let i = 0; i < faturamentoData.length; i += batchSize) {
      const batch = faturamentoData.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('faturamento')
        .insert(batch)

      if (insertError) {
        console.error('Erro ao inserir lote:', insertError)
        throw new Error(`Erro ao inserir dados: ${insertError.message}`)
      }
      
      totalInserted += batch.length
      console.log(`Lote ${Math.floor(i/batchSize) + 1} inserido: ${batch.length} registros`)
    }

    // Atualizar log de sucesso
    if (logData?.id) {
      await supabase
        .from('upload_logs')
        .update({
          status: 'completed',
          records_processed: totalInserted
        })
        .eq('id', logData.id)
    }

    console.log('Processamento concluído com sucesso')

    return new Response(JSON.stringify({
      success: true,
      message: 'Arquivo processado com sucesso',
      recordsProcessed: totalInserted
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro no processamento:', error)
    
    // Atualizar log com erro se possível
    try {
      if (logData?.id) {
        await supabase
          .from('upload_logs')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('id', logData.id)
      }
    } catch (logError) {
      console.error('Erro ao atualizar log:', logError)
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})