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
    const { file_path, arquivo_fonte, start_row = 0, batch_size = 500 } = requestBody;

    console.log(`=== PROCESSAMENTO COMPLETO - BATCH ${Math.floor(start_row / batch_size) + 1} ===`);
    console.log(`📋 Dados recebidos:`, JSON.stringify(requestBody));
    console.log(`📂 Arquivo: ${file_path}`);
    console.log(`📑 Fonte: ${arquivo_fonte}`);
    console.log(`📊 Linha inicial: ${start_row}`);
    console.log(`📦 Tamanho do batch: ${batch_size}`);

    if (!file_path) {
      throw new Error('file_path é obrigatório');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Baixar arquivo
    console.log(`📥 Tentando baixar arquivo: ${file_path}`);
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('❌ Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${JSON.stringify(downloadError)}`);
    }

    if (!fileData) {
      console.error('❌ Arquivo não encontrado ou vazio');
      throw new Error('Arquivo não encontrado no storage');
    }

    console.log('✅ Arquivo baixado, tamanho:', fileData.size);

    // Ler Excel completo para obter total de linhas
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellDates: false,
      dense: true,
      bookSST: false
    });

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const fullData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      raw: true,
      dateNF: 'dd/mm/yyyy',
      blankrows: false
    });

    const totalRecords = fullData.length;
    console.log(`📊 Total de registros no arquivo: ${totalRecords}`);

    // Extrair apenas o batch atual
    const endRow = Math.min(start_row + batch_size, totalRecords);
    const batchData = fullData.slice(start_row, endRow);
    const actualBatchSize = batchData.length;

    console.log(`📦 Processando batch: linhas ${start_row + 1} a ${endRow} (${actualBatchSize} registros)`);

    if (actualBatchSize === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "Batch vazio - processamento concluído",
        batch_info: {
          start_row,
          end_row: endRow,
          batch_size: actualBatchSize,
          total_records: totalRecords,
          completed: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Processar dados do batch
    const loteUpload = `${arquivo_fonte}_batch_${Math.floor(start_row / batch_size)}_${Date.now()}`;
    const periodoReferencia = new Date().toISOString().substring(0, 7);

    let inserted = 0;
    let errors = 0;

    for (const row of batchData) {
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

        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(record);

        if (insertError) {
          console.error('Erro ao inserir:', insertError);
          errors++;
        } else {
          inserted++;
        }
      } catch (rowError) {
        console.error('Erro ao processar linha:', rowError);
        errors++;
      }
    }

    console.log(`✅ Batch processado: ${inserted} inseridos, ${errors} erros`);

    // Aplicar de-para se for arquivo de volumetria
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

    const nextStartRow = endRow;
    const hasMore = nextStartRow < totalRecords;
    const progress = Math.round((endRow / totalRecords) * 100);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch ${Math.floor(start_row / batch_size) + 1} processado: ${inserted} inseridos, ${deParaUpdated} de-para aplicados`,
      batch_info: {
        start_row,
        end_row: endRow,
        batch_size: actualBatchSize,
        total_records: totalRecords,
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
    console.error('💥 ERRO CRÍTICO na função de processamento completo:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      toString: error.toString()
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido',
      error_details: error.toString(),
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});