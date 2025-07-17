import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://cdn.skypack.dev/xlsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== PROCESSAR FATURAMENTO INICIADO ===')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const requestBody = await req.json()
    const { fileName } = requestBody

    console.log('Processando arquivo de faturamento:', fileName)

    // Retrieve the uploaded file from storage
    const { data: fileData, error: fileError } = await supabaseClient.storage
      .from('uploads')
      .download(fileName)

    if (fileError) {
      console.error('Erro ao baixar arquivo:', fileError)
      throw fileError
    }

    // Convert file to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Validate file structure
    if (data.length < 2) {
      throw new Error('Arquivo vazio ou sem dados')
    }

    // Debugging - log the first few rows to see structure
    console.log('Primeiras linhas do arquivo:')
    console.log('Headers:', data[0])
    console.log('Primeira linha de dados:', data[1])
    
     // Extract faturamento data with all columns shown in the image
     // paciente, medico, data_exame, modalidade, especialidade, categoria, prioridade, nome exame, quantidade, valor_bruto
     const faturamentoData = []
     
     for (let i = 1; i < data.length; i++) {
       const row = data[i]
       
       // Check if row has the necessary data before processing
       if (!row || !row[1] || row.length < 2) { // Nome (CLIENTE) ainda é obrigatório
         console.log(`Linha ${i} inválida ignorada:`, row)
         continue
       }
       
       // Log cada linha processada para debug
       console.log(`Processando linha ${i}:`, {
         paciente: row[0],
         cliente: row[1], 
         medico: row[2],
         quantidade: row[9],
         valor: row[10]
       })
       
       const faturamentoItem = {
         nome: String(row[1]).trim(), // Coluna B (nome do cliente)
         
         // Colunas detalhadas para relatório
         paciente: row[0] ? String(row[0]).trim() : 'NÃO INFORMADO', // Coluna A (paciente)
         medico: row[2] ? String(row[2]).trim() : 'NÃO INFORMADO', // Coluna C (medico)
         data_exame: row[3] ? new Date(row[3]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], // Coluna D (data)
         modalidade: row[4] ? String(row[4]).trim() : 'NÃO INFORMADO', // Coluna E (modalidade)
         especialidade: row[5] ? String(row[5]).trim() : 'NÃO INFORMADO', // Coluna F (especialidade)
         categoria: row[6] ? String(row[6]).trim() : 'NORMAL', // Coluna G (categoria)
         prioridade: row[7] ? String(row[7]).trim() : 'NORMAL', // Coluna H (prioridade)
         nome_exame: row[8] ? String(row[8]).trim() : 'EXAME NÃO ESPECIFICADO', // Coluna I (nome exame)
         
         // Colunas essenciais para faturamento - garantir que são números
         quantidade: row[9] ? parseInt(row[9]) || 1 : 1, // Coluna J (quantidade)
         valor_bruto: row[10] ? parseFloat(row[10]) || 0 : 0, // Coluna K (valor_bruto)
         
         // Campos auxiliares
         data_emissao: new Date().toISOString().split('T')[0],
         numero_fatura: `FAT-${String(row[1]).substring(0, 3).toUpperCase()}-${i}-2025-07`,
         periodo: "2025-07"
       }
       
       // Só adiciona se tem dados válidos
       if (faturamentoItem.nome && (faturamentoItem.quantidade > 0 || faturamentoItem.valor_bruto > 0)) {
         faturamentoData.push(faturamentoItem)
       }
     }

    console.log('Dados extraídos:', faturamentoData)
    console.log(`Total de registros extraídos: ${faturamentoData.length}`)

    // Log do início do processamento
    const { data: logEntry, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: fileName,
        file_type: 'faturamento', // Importante: corrigido para 'faturamento'
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      console.error('Erro ao criar log:', logError)
    }

    // Inserir dados no banco
    const { data: faturamentoInserido, error: faturamentoError } = await supabaseClient
      .from('faturamento')
      .insert(faturamentoData)
      .select()

    if (faturamentoError) {
      console.error('Erro ao inserir dados de faturamento:', faturamentoError)
      throw new Error(`Erro ao inserir dados de faturamento: ${faturamentoError.message}`)
    }

    // Atualizar log com sucesso
    if (logEntry) {
      const { error: updateLogError } = await supabaseClient
        .from('upload_logs')
        .update({
          status: 'completed',
          records_processed: faturamentoData.length
        })
        .eq('id', logEntry.id)

      if (updateLogError) {
        console.error('Erro ao atualizar log:', updateLogError.message)
      }
    }

    console.log(`Processamento concluído! ${faturamentoData.length} registros de faturamento inseridos.`)

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados: faturamentoData.length,
        registros_erro: 0,
        mensagem: `${faturamentoData.length} registros de faturamento processados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===')
    console.error('Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})