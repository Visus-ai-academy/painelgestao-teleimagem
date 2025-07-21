import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

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

    // Por enquanto, vamos inserir apenas dados de teste para verificar se o problema é na leitura do Excel
    // Usando o período atual (2025-01) no número da fatura para que o frontend encontre os dados
    const periodoAtual = '2025-01';
    const dadosTeste = [
      {
        omie_id: `TEST_${Date.now()}_1`,
        numero_fatura: `NF_${periodoAtual}_TEST_1`,
        cliente_nome: 'Cliente Teste 1',
        cliente_email: 'teste1@email.com',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        data_pagamento: null,
        valor: 100.00,
        status: 'em_aberto'
      },
      {
        omie_id: `TEST_${Date.now()}_2`,
        numero_fatura: `NF_${periodoAtual}_TEST_2`,
        cliente_nome: 'Cliente Teste 2',
        cliente_email: 'teste2@email.com',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: new Date().toISOString().split('T')[0],
        data_pagamento: null,
        valor: 200.00,
        status: 'em_aberto'
      }
    ];

    console.log('6. Inserindo dados de teste...')

    const { data: insertData, error: insertError } = await supabase
      .from('faturamento')
      .insert(dadosTeste)
      .select()

    if (insertError) {
      console.error('Erro ao inserir dados de faturamento:', insertError)
      throw new Error('Erro ao inserir faturamento: ' + insertError.message)
    }

    console.log('6.1 Dados inseridos:', insertData?.length || 0, 'registros')

    console.log('7. Dados inseridos com sucesso')

    // Atualizar log de sucesso
    if (logData?.id) {
      await supabase
        .from('upload_logs')
        .update({
          status: 'completed',
          records_processed: dadosTeste.length
        })
        .eq('id', logData.id)
    }

    console.log('8. Processamento concluído com sucesso')

    return new Response(JSON.stringify({
      success: true,
      message: 'Arquivo processado com sucesso (modo teste)',
      recordsProcessed: dadosTeste.length,
      note: 'Usando dados de teste temporariamente'
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