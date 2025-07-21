import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO V2 ===')
  
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
    console.log('1. Iniciando processamento...')
    
    const body = await req.json()
    const fileName = body?.fileName
    
    if (!fileName) {
      throw new Error('Nome do arquivo é obrigatório')
    }
    
    console.log('2. Processando arquivo:', fileName)

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

    if (logError) {
      console.error('Erro ao criar log:', logError)
      throw new Error('Erro ao criar log de upload')
    }

    logData = logResult;
    console.log('3. Log criado com ID:', logData?.id)

    // Baixar arquivo do storage
    console.log('4. Baixando arquivo do storage...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileName)

    if (downloadError) {
      console.error('Erro ao baixar arquivo:', downloadError)
      throw new Error('Erro ao baixar arquivo: ' + downloadError.message)
    }

    if (!fileData) {
      throw new Error('Arquivo não encontrado no storage')
    }

    console.log('5. Arquivo baixado, tamanho:', fileData.size)

    // Processar arquivo Excel
    console.log('6. Processando arquivo Excel...')
    
    // Converter o arquivo para buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Ler arquivo Excel
    const workbook = XLSX.read(uint8Array, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Converter para JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    console.log('7. Dados extraídos do Excel:', jsonData.length, 'linhas')
    
    if (jsonData.length < 2) {
      throw new Error('Arquivo Excel vazio ou sem dados')
    }

    // Primeira linha são os cabeçalhos
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1)
    
    console.log('8. Cabeçalhos encontrados:', headers)
    
    // Mapear dados para o formato da tabela faturamento
    const dadosFaturamento = []
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[]
      
      if (!row || row.length === 0) continue // Pular linhas vazias
      
      // Função auxiliar para converter datas
      const parseDate = (value: any): string => {
        if (!value) return new Date().toISOString().split('T')[0]
        
        // Se é um número do Excel (dias desde 1900)
        if (typeof value === 'number' && value > 0) {
          const excelEpoch = new Date(1900, 0, 1)
          const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
          return date.toISOString().split('T')[0]
        }
        
        // Se é string, tentar converter
        if (typeof value === 'string') {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        }
        
        // Fallback para data atual
        return new Date().toISOString().split('T')[0]
      }
      
      // Mapear campos baseado no template CSV de faturamento
      const registro = {
        omie_id: row[0] ? String(row[0]) : `GEN_${Date.now()}_${i}`,
        numero_fatura: row[1] ? String(row[1]) : `NF_${Date.now()}_${i}`,
        cliente_nome: row[2] ? String(row[2]) : 'Cliente Não Informado',
        cliente_email: row[3] ? String(row[3]) : null,
        data_emissao: parseDate(row[4]),
        data_vencimento: parseDate(row[5]),
        data_pagamento: row[6] ? parseDate(row[6]) : null,
        valor: parseFloat(row[7]) || 0,
        status: row[8] ? String(row[8]) : 'em_aberto'
      }
      
      dadosFaturamento.push(registro)
    }
    
    console.log('9. Dados mapeados:', dadosFaturamento.length, 'registros')
    
    if (dadosFaturamento.length === 0) {
      throw new Error('Nenhum dado válido encontrado no arquivo')
    }

    // Inserir dados no banco
    console.log('10. Inserindo dados no banco...')
    
    const { data: insertData, error: insertError } = await supabase
      .from('faturamento')
      .insert(dadosFaturamento)
      .select()

    if (insertError) {
      console.error('Erro ao inserir dados de faturamento:', insertError)
      throw new Error('Erro ao inserir faturamento: ' + insertError.message)
    }

    console.log('11. Dados inseridos:', insertData?.length || 0, 'registros')

    // Atualizar log de sucesso
    if (logData?.id) {
      await supabase
        .from('upload_logs')
        .update({
          status: 'completed',
          records_processed: dadosFaturamento.length
        })
        .eq('id', logData.id)
    }

    console.log('12. Processamento concluído com sucesso')

    return new Response(JSON.stringify({
      success: true,
      message: 'Arquivo processado com sucesso',
      recordsProcessed: dadosFaturamento.length,
      sampleData: dadosFaturamento.slice(0, 3) // Primeiros 3 registros como amostra
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
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})