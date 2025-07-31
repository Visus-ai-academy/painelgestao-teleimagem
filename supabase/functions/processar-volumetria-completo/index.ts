import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { file_path, arquivo_fonte, start_row = 0, batch_size = 10 } = requestBody; // Ultra pequeno: apenas 10 registros

    console.log(`=== PROCESSAMENTO COMPLETO - BATCH ${Math.floor(start_row / batch_size) + 1} ===`);
    console.log(`📂 Arquivo: ${file_path}`);
    console.log(`📑 Fonte: ${arquivo_fonte}`);
    console.log(`📊 Linha inicial: ${start_row}, Batch size: ${batch_size}`);

    if (!file_path) {
      throw new Error('file_path é obrigatório');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Baixar arquivo do storage
    console.log(`📥 Tentando baixar arquivo: ${file_path}`);
    
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('❌ Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${JSON.stringify(downloadError)}`);
    }

    if (!fileData) {
      throw new Error('Arquivo não encontrado no storage');
    }

    console.log('✅ Arquivo baixado, tamanho:', fileData.size);

    // Processar Excel de forma ultra otimizada para máxima economia de memória
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Usar apenas a quantidade mínima de memória necessária
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellDates: false,
      dense: true,  // Usar dense para economizar memória
      bookSST: false,
      raw: false,  // Não raw para economizar processamento
      sheetRows: start_row + batch_size + 1  // Ler apenas as linhas necessárias
    });

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Se não há dados na planilha na faixa especificada
    if (!worksheet || !worksheet['!ref']) {
      return new Response(JSON.stringify({
        success: true,
        message: "Processamento concluído - não há mais dados",
        batch_info: {
          start_row,
          end_row: start_row,
          batch_size: 0,
          total_records: 0,
          inserted: 0,
          errors: 0,
          de_para_updated: 0,
          progress_percent: 100,
          has_more: false,
          next_start_row: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Obter apenas o range necessário
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const totalRows = range.e.r;
    
    console.log(`📊 Total de linhas detectadas: ${totalRows}`);
    
    if (start_row >= totalRows - 1) {
      return new Response(JSON.stringify({
        success: true,
        message: "Processamento concluído - não há mais dados",
        batch_info: {
          start_row,
          end_row: start_row,
          batch_size: 0,
          total_records: totalRows - 1,
          inserted: 0,
          errors: 0,
          de_para_updated: 0,
          progress_percent: 100,
          has_more: false,
          next_start_row: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Processar apenas o batch ultra pequeno
    const actualStartRow = start_row + 1;
    const endRow = Math.min(actualStartRow + batch_size, totalRows);
    
    console.log(`📦 Processando linhas ${actualStartRow} a ${endRow - 1}`);
    console.log(`📊 Worksheet ref:`, worksheet['!ref']);
    console.log(`📊 Total rows:`, totalRows);
    console.log(`📊 Start row:`, actualStartRow);
    console.log(`📊 End row:`, endRow);
    
    // Verificar se há dados para processar
    if (actualStartRow >= endRow) {
      console.log('⚠️ Não há dados para processar neste batch');
      return new Response(JSON.stringify({
        success: true,
        message: "Processamento concluído - não há dados neste batch",
        batch_info: {
          start_row,
          end_row: actualStartRow,
          batch_size: 0,
          total_records: totalRows - 1,
          inserted: 0,
          errors: 0,
          de_para_updated: 0,
          progress_percent: 100,
          has_more: false,
          next_start_row: null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // Extrair dados do batch linha por linha para economizar memória
    const batchData = [];
    
    // Primeiro, obter os cabeçalhos da primeira linha
    const headerRow: any = {};
    const headerColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    for (let colIndex = 0; colIndex < headerColumns.length; colIndex++) {
      const cellRef = headerColumns[colIndex] + '1';
      const cell = worksheet[cellRef];
      if (cell) {
        headerRow[colIndex] = cell.v;
      }
    }
    
    console.log('📋 Cabeçalhos detectados:', headerRow);
    
    for (let rowIndex = actualStartRow; rowIndex < endRow; rowIndex++) {
      const row: any = {};
      
      for (let colIndex = 0; colIndex < headerColumns.length; colIndex++) {
        const cellRef = headerColumns[colIndex] + (rowIndex + 1);
        const cell = worksheet[cellRef];
        if (cell && headerRow[colIndex]) {
          // Usar o nome da coluna do cabeçalho
          row[headerRow[colIndex]] = cell.v;
        }
      }
      
      // Verificar se a linha tem dados essenciais
      if (row['EMPRESA'] || row['NOME_PACIENTE'] || Object.keys(row).length > 0) {
        batchData.push(row);
        console.log(`📝 Linha ${rowIndex + 1}:`, row);
      }
    }
    
    console.log(`✅ Batch carregado: ${batchData.length} registros`);
    
    // Extrair dados linha por linha para economizar memória
    const loteUpload = `${arquivo_fonte}_batch_${Math.floor(start_row / batch_size)}_${Date.now()}`;
    const periodoReferencia = new Date().toISOString().substring(0, 7);

    let inserted = 0;
    let errors = 0;

    // Processar registros em mini-batches muito pequenos para evitar sobrecarga
    const miniBatchSize = 3; // Ainda menor: apenas 3 registros por vez
    for (let i = 0; i < batchData.length; i += miniBatchSize) {
      const miniBatch = batchData.slice(i, i + miniBatchSize);
      const records = [];

      for (const row of miniBatch) {
        try {
          if (!row['EMPRESA'] || !row['NOME_PACIENTE']) continue;

          const record = {
            EMPRESA: String(row['EMPRESA']).trim(),
            NOME_PACIENTE: String(row['NOME_PACIENTE']).trim(),
            arquivo_fonte: arquivo_fonte,
            lote_upload: loteUpload,
            periodo_referencia: periodoReferencia,
            CODIGO_PACIENTE: row['CODIGO_PACIENTE'] ? String(row['CODIGO_PACIENTE']).trim() : null,
            ESTUDO_DESCRICAO: row['ESTUDO_DESCRICAO'] ? String(row['ESTUDO_DESCRICAO']).trim() : null,
            ACCESSION_NUMBER: row['ACCESSION_NUMBER'] ? String(row['ACCESSION_NUMBER']).trim() : null,
            MODALIDADE: row['MODALIDADE'] ? String(row['MODALIDADE']).trim() : null,
            PRIORIDADE: row['PRIORIDADE'] ? String(row['PRIORIDADE']).trim() : null,
            ESPECIALIDADE: row['ESPECIALIDADE'] ? String(row['ESPECIALIDADE']).trim() : null,
            MEDICO: row['MEDICO'] ? String(row['MEDICO']).trim() : null,
            VALORES: row['VALORES'] ? Math.floor(Number(row['VALORES'])) : null,
            data_referencia: row['DATA_REALIZACAO'] ? new Date(row['DATA_REALIZACAO']) : null
          };

          records.push(record);
        } catch (rowError) {
          console.error('Erro ao processar linha:', rowError);
          errors++;
        }
      }

      // Inserir mini-batch
      if (records.length > 0) {
        try {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(records);

          if (insertError) {
            console.error('Erro ao inserir mini-batch:', insertError);
            errors += records.length;
          } else {
            inserted += records.length;
          }
        } catch (insertError) {
          console.error('Erro crítico na inserção:', insertError);
          errors += records.length;
        }
      }
    }

    console.log(`✅ Batch processado: ${inserted} inseridos, ${errors} erros`);

    // Aplicar de-para se necessário
    let deParaUpdated = 0;
    if (arquivo_fonte.includes('volumetria') && inserted > 0) {
      try {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivo_fonte 
        });
        deParaUpdated = deParaResult?.registros_atualizados || 0;
        console.log(`✅ De-Para aplicado: ${deParaUpdated} registros atualizados`);
      } catch (deParaError) {
        console.log(`⚠️ Erro no de-para (ignorado): ${deParaError.message}`);
      }
    }

    const nextStartRow = endRow - 1; // -1 porque endRow é exclusivo
    const hasMore = nextStartRow < totalRows - 1;
    const progress = Math.round(((endRow - 1) / (totalRows - 1)) * 100);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch ${Math.floor(start_row / batch_size) + 1} processado: ${inserted} inseridos, ${deParaUpdated} de-para aplicados`,
      batch_info: {
        start_row,
        end_row: endRow - 1,
        batch_size: batchData.length,
        total_records: totalRows - 1,
        inserted,
        errors,
        de_para_updated: deParaUpdated,
        progress_percent: progress,
        has_more: hasMore,
        next_start_row: hasMore ? nextStartRow : null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      error_details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});