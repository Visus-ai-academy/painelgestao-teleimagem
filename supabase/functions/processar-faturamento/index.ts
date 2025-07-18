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
    const workbook = read(arrayBuffer)
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Planilha não encontrada no arquivo')
    }
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = utils.sheet_to_json(worksheet)

    console.log('Dados extraídos:', jsonData?.length || 0, 'registros')
    
    // Debug: Log column names from first row
    if (jsonData && jsonData.length > 0) {
      console.log('Colunas encontradas:', Object.keys(jsonData[0]))
      console.log('Primeira linha de dados:', jsonData[0])
    }

    // Processar dados com mapeamento mais flexível
    const faturamentoData = jsonData.map((row: any) => {
      // Buscar as colunas por diferentes variações de nomes
      const getColumnValue = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name]
          }
        }
        return ''
      }

      return {
        omie_id: getColumnValue(['ID', 'id', 'omie_id', 'Id']) || `FAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        numero_fatura: getColumnValue(['Número da Fatura', 'numero_fatura', 'NumeroFatura', 'Numero', 'numero']) || `${Date.now()}`,
        cliente_nome: getColumnValue(['Cliente', 'cliente_nome', 'ClienteNome', 'Nome Cliente', 'nome_cliente']),
        cliente_email: getColumnValue(['Email', 'cliente_email', 'ClienteEmail', 'E-mail', 'email']),
        data_emissao: getColumnValue(['Data de Emissão', 'data_emissao', 'DataEmissao', 'Emissão', 'emissao']),
        data_vencimento: getColumnValue(['Data de Vencimento', 'data_vencimento', 'DataVencimento', 'Vencimento', 'vencimento']) || getColumnValue(['Data de Emissão', 'data_emissao', 'DataEmissao', 'Emissão', 'emissao']),
        data_pagamento: getColumnValue(['Data de Pagamento', 'data_pagamento', 'DataPagamento', 'Pagamento', 'pagamento']) || null,
        valor: parseFloat(getColumnValue(['Valor', 'valor', 'ValorTotal', 'Total', 'total']) || '0'),
        status: getColumnValue(['Status', 'status', 'Situação', 'situacao']) || 'pendente'
      }
    }).filter(item => item.cliente_nome && item.cliente_nome.trim() !== '')

    console.log('Dados processados:', faturamentoData.length, 'registros válidos')

    // Inserir dados na tabela faturamento
    const { error: insertError } = await supabase
      .from('faturamento')
      .insert(faturamentoData)

    if (insertError) {
      console.error('Erro ao inserir dados:', insertError)
      throw new Error('Erro ao inserir dados de faturamento')
    }

    // Atualizar log de sucesso
    if (logData?.id) {
      await supabase
        .from('upload_logs')
        .update({
          status: 'completed',
          records_processed: faturamentoData.length
        })
        .eq('id', logData.id)
    }

    console.log('Processamento concluído com sucesso')

    return new Response(JSON.stringify({
      success: true,
      message: 'Arquivo processado com sucesso',
      recordsProcessed: faturamentoData.length
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