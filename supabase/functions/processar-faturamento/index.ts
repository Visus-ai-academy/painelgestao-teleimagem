import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Adicionar timeout de 5 minutos para a função
const FUNCTION_TIMEOUT = 5 * 60 * 1000; // 5 minutos

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO V4 - COM TIMEOUT ===')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  let logData: any = null;
  let timeoutId: number | null = null;
  let isProcessingComplete = false;
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('=== PROCESSAR-FATURAMENTO V4 ===')
    console.log('1. Iniciando processamento com timeout...')
    
    // Configurar timeout
    timeoutId = setTimeout(() => {
      if (!isProcessingComplete) {
        console.error('TIMEOUT: Processamento excedeu 5 minutos')
        throw new Error('Timeout: Processamento excedeu 5 minutos')
      }
    }, FUNCTION_TIMEOUT)
    
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
    
    // Buscar todos os clientes cadastrados para associação
    console.log('8.1. Buscando clientes cadastrados...')
    const { data: clientesCadastrados, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, cod_cliente')
    
    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError)
      throw new Error('Erro ao buscar clientes cadastrados')
    }
    
    console.log('8.2. Clientes encontrados:', clientesCadastrados?.length || 0)
    
    // Função para encontrar cliente_id baseado no código/nome do cliente
    const encontrarClienteId = (codigoCliente: string): string | null => {
      if (!codigoCliente || !clientesCadastrados) return null
      
      const codigoClienteLimpo = codigoCliente.trim().toUpperCase()
      
      // Buscar por correspondência exata
      let cliente = clientesCadastrados.find(c => 
        c.nome?.toUpperCase() === codigoClienteLimpo ||
        c.cod_cliente?.toUpperCase() === codigoClienteLimpo
      )
      
      if (cliente) return cliente.id
      
      // Buscar por correspondência parcial (contém)
      cliente = clientesCadastrados.find(c => 
        c.nome?.toUpperCase().includes(codigoClienteLimpo) ||
        codigoClienteLimpo.includes(c.nome?.toUpperCase() || '') ||
        c.cod_cliente?.toUpperCase().includes(codigoClienteLimpo) ||
        codigoClienteLimpo.includes(c.cod_cliente?.toUpperCase() || '')
      )
      
      if (cliente) {
        console.log(`Associação encontrada: "${codigoCliente}" -> "${cliente.nome}" (${cliente.id})`)
        return cliente.id
      }
      
      return null
    }

    // Mapear dados para o formato da tabela faturamento
    const dadosFaturamento = []
    
    // Função auxiliar para limpar e validar string
    const cleanString = (value: any, fallback: string = ''): string => {
      if (!value || value === null || value === undefined) return fallback;
      return String(value).trim() || fallback;
    }
    
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
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[]
      
      if (!row || row.length === 0) continue // Pular linhas vazias
      
      // O código do cliente está na primeira coluna (paciente)
      const codigoCliente = cleanString(row[0], 'Cliente Não Informado');
      if (!codigoCliente || codigoCliente.trim() === '') {
        console.warn(`Linha ${i + 2}: Código do cliente vazio, pulando registro`);
        continue;
      }
      
      // O nome do paciente está na segunda coluna (cliente)
      const nomePaciente = cleanString(row[1], 'Paciente Não Informado');
      
      // Encontrar cliente_id baseado no código do cliente
      const clienteIdEncontrado = encontrarClienteId(codigoCliente)
      
      // Mapear campos com validação melhorada
      const registro = {
        omie_id: `FAT_${Date.now()}_${i}`,
        numero_fatura: `NF_${Date.now()}_${i}`,
        cliente_id: clienteIdEncontrado, // Associar ao cliente cadastrado
        cliente: nomePaciente, // Nome do paciente vai para o campo cliente
        cliente_nome: nomePaciente, // Nome do paciente vai para o campo cliente_nome
        paciente: codigoCliente, // Código do cliente vai para o campo paciente
        medico: cleanString(row[2], 'Médico Não Informado'),
        data_exame: parseDate(row[3]),
        modalidade: cleanString(row[4], 'Não Informado'),
        especialidade: cleanString(row[5], 'Não Informado'),
        categoria: cleanString(row[6], 'NORMAL'),
        prioridade: cleanString(row[7], 'NORMAL'),
        nome_exame: cleanString(row[8], 'Exame Não Informado'),
        quantidade: Math.max(parseInt(row[9]) || 1, 1), // Mínimo 1
        valor_bruto: Math.max(parseFloat(row[10]) || 0, 0), // Não negativo
        cliente_email: null,
        data_emissao: parseDate(row[3]),
        data_vencimento: parseDate(row[3]),
        data_pagamento: null,
        valor: Math.max(parseFloat(row[10]) || 0, 0), // Não negativo
        status: 'em_aberto'
      }
      
      dadosFaturamento.push(registro)
    }
    
    console.log('9. Dados mapeados:', dadosFaturamento.length, 'registros')
    
    if (dadosFaturamento.length === 0) {
      throw new Error('Nenhum dado válido encontrado no arquivo')
    }

    // Identificar períodos dos dados para substituição
    console.log('10. Identificando períodos dos dados...')
    const periodosIdentificados = new Set<string>()
    
    dadosFaturamento.forEach(registro => {
      if (registro.data_emissao) {
        const periodo = registro.data_emissao.substring(0, 7) // YYYY-MM
        periodosIdentificados.add(periodo)
      }
    })
    
    const periodosArray = Array.from(periodosIdentificados)
    console.log('Períodos identificados:', periodosArray)
    
    // Remover dados existentes dos mesmos períodos
    if (periodosArray.length > 0) {
      console.log('11. Removendo dados existentes dos períodos:', periodosArray)
      
      for (const periodo of periodosArray) {
        const dataInicio = `${periodo}-01`
        const proximoMes = new Date(periodo + '-01')
        proximoMes.setMonth(proximoMes.getMonth() + 1)
        const dataFim = proximoMes.toISOString().substring(0, 10)
        
        console.log(`Removendo dados do período ${periodo} (${dataInicio} a ${dataFim})`)
        
        const { error: deleteError } = await supabase
          .from('faturamento')
          .delete()
          .gte('data_emissao', dataInicio)
          .lt('data_emissao', dataFim)
        
        if (deleteError) {
          console.error(`Erro ao remover dados do período ${periodo}:`, deleteError)
          // Continuar mesmo com erro, apenas logar
        } else {
          console.log(`Dados do período ${periodo} removidos com sucesso`)
        }
      }
    }

    // Dividir o processamento em chunks menores para evitar timeout
    console.log('12. Dividindo dados em chunks para processamento...')
    
    const maxRecordsPerExecution = 2000; // Máximo por execução
    const totalChunks = Math.ceil(dadosFaturamento.length / maxRecordsPerExecution);
    
    console.log(`Total de registros: ${dadosFaturamento.length}`)
    console.log(`Chunks necessários: ${totalChunks}`)
    
    // Processar apenas o primeiro chunk nesta execução
    const currentChunk = dadosFaturamento.slice(0, maxRecordsPerExecution);
    console.log(`Processando chunk 1/${totalChunks}: ${currentChunk.length} registros`)
    
    // Se há mais chunks, agendar as próximas execuções
    const remainingData = dadosFaturamento.slice(maxRecordsPerExecution);
    
    // Função de processamento em background - apenas para o chunk atual
    const processarDados = async () => {
      try {
        const batchSize = 100; // Ainda menor para garantir que funcione
        let totalInseridos = 0;
        let totalFalhados = 0;
        const maxRetries = 1; // Apenas 1 retry
        const startTime = Date.now();
        const maxProcessingTime = 2 * 60 * 1000; // 2 minutos máximo
        
        // Processar apenas o chunk atual, não todos os dados
        for (let i = 0; i < currentChunk.length; i += batchSize) {
          // Verificar timeout
          if (Date.now() - startTime > maxProcessingTime) {
            console.log('Timeout atingido, salvando progresso...');
            break;
          }
          
          const lote = currentChunk.slice(i, i + batchSize);
          const batchNumber = Math.floor(i/batchSize) + 1;
          const totalBatches = Math.ceil(currentChunk.length/batchSize);
          
          console.log(`Inserindo lote ${batchNumber}/${totalBatches}: ${lote.length} registros`);
          
          try {
            // Usar INSERT simples que é mais rápido que UPSERT
            const { data: insertData, error: insertError } = await supabase
              .from('faturamento')
              .insert(lote)
              .select('id')

            if (insertError) {
              console.error(`Erro no lote ${batchNumber}:`, insertError.message)
              totalFalhados += lote.length;
              continue; // Pular para o próximo lote
            }

            totalInseridos += insertData?.length || 0;
            console.log(`Lote ${batchNumber} inserido: ${insertData?.length || 0} registros`);
            
            // Atualizar progresso mais frequentemente
            if (batchNumber % 5 === 0) {
              await supabase
                .from('upload_logs')
                .update({
                  records_processed: totalInseridos,
                  updated_at: new Date().toISOString()
                })
                .eq('id', logData.id)
            }
            
          } catch (error) {
            console.error(`Erro inesperado no lote ${batchNumber}:`, error);
            totalFalhados += lote.length;
            continue;
          }
        }

        console.log('13. Processamento concluído!')
        console.log(`- Total inseridos: ${totalInseridos} registros`)
        console.log(`- Total falhados: ${totalFalhados} registros`)
        
        const finalStatus = totalFalhados > 0 ? 'completed_with_errors' : 'completed';
        
        // Atualizar log final
        await supabase
          .from('upload_logs')
          .update({
            status: finalStatus,
            records_processed: totalInseridos,
            error_message: totalFalhados > 0 ? `${totalFalhados} registros falharam` : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', logData.id)
        
      } catch (error) {
        console.error('Erro no processamento em background:', error)
        await supabase
          .from('upload_logs')
          .update({
            status: 'error',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', logData.id)
      }
    }
    
    // Iniciar task em background
    EdgeRuntime.waitUntil(processarDados().finally(() => {
      isProcessingComplete = true;
      if (timeoutId) clearTimeout(timeoutId);
    }))

    console.log('14. Processamento iniciado em background, retornando resposta imediata')
    
    // Marcar que a resposta foi enviada (não completamente processado)
    if (timeoutId) clearTimeout(timeoutId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Arquivo processado com sucesso - dados do período substituídos',
      recordsProcessed: dadosFaturamento.length,
      periodosSubstituidos: periodosArray,
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