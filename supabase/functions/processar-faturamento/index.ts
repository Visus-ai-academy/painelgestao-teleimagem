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
    console.log('=== PROCESSAR-FATURAMENTO V3 ===')
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
      
      // Mapear campos baseado no template CSV de faturamento e mapeamentos
      // Template: Paciente;Cliente;Medico;Data_Exame;Modalidade;Especialidade;Categoria;Prioridade;Nome_Exame;Quantidade;Valor_Bruto
      const registro = {
        omie_id: `FAT_${Date.now()}_${i}`,
        numero_fatura: `NF_${Date.now()}_${i}`,
        cliente: row[1] ? String(row[1]) : 'Cliente Não Informado', // Cliente (coluna 1)
        paciente: row[0] ? String(row[0]) : 'Paciente Não Informado', // Paciente (coluna 0)
        medico: row[2] ? String(row[2]) : 'Médico Não Informado', // Medico (coluna 2)
        data_exame: parseDate(row[3]), // Data_Exame (coluna 3)
        modalidade: row[4] ? String(row[4]) : 'Não Informado', // Modalidade (coluna 4)
        especialidade: row[5] ? String(row[5]) : 'Não Informado', // Especialidade (coluna 5)
        categoria: row[6] ? String(row[6]) : 'NORMAL', // Categoria (coluna 6)
        prioridade: row[7] ? String(row[7]) : 'NORMAL', // Prioridade (coluna 7)
        nome_exame: row[8] ? String(row[8]) : 'Exame Não Informado', // Nome_Exame (coluna 8)
        quantidade: parseInt(row[9]) || 1, // Quantidade (coluna 9)
        valor_bruto: parseFloat(row[10]) || 0, // Valor_Bruto (coluna 10)
        cliente_email: null,
        data_emissao: parseDate(row[3]), // Data_Exame (coluna 3)
        data_vencimento: parseDate(row[3]), // Usar mesma data do exame
        data_pagamento: null,
        valor: parseFloat(row[10]) || 0, // Valor_Bruto (coluna 10)
        status: 'em_aberto'
      }
      
      dadosFaturamento.push(registro)
    }
    
    console.log('9. Dados mapeados:', dadosFaturamento.length, 'registros')
    
    if (dadosFaturamento.length === 0) {
      throw new Error('Nenhum dado válido encontrado no arquivo')
    }

    // Inserir dados no banco em lotes para evitar timeout
    console.log('10. Inserindo dados no banco...')
    
    const batchSize = 1000; // Processar em lotes de 1000 registros
    let totalInseridos = 0;
    
    for (let i = 0; i < dadosFaturamento.length; i += batchSize) {
      const lote = dadosFaturamento.slice(i, i + batchSize);
      console.log(`Inserindo lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(dadosFaturamento.length/batchSize)}: ${lote.length} registros`);
      
      const { data: insertData, error: insertError } = await supabase
        .from('faturamento')
        .insert(lote)
        .select()

      if (insertError) {
        console.error('Erro ao inserir lote de faturamento:', insertError)
        throw new Error('Erro ao inserir faturamento (lote): ' + insertError.message)
      }

      totalInseridos += insertData?.length || 0;
      console.log(`Lote inserido: ${insertData?.length || 0} registros`);
    }

    console.log('11. Total de dados inseridos:', totalInseridos, 'registros')

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