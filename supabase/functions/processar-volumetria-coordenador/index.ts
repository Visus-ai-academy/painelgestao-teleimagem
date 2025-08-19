import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 COORDENADOR SIMPLIFICADO - Processa diretamente sem fallbacks complexos
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, upload_id } = await req.json();
    
    console.log('🎯 [COORDENADOR-V2] Iniciando processamento direto:', {
      file_path,
      arquivo_fonte,
      periodo_referencia,
      upload_id
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Baixar arquivo diretamente
    console.log('📥 [COORDENADOR-V2] Baixando arquivo:', file_path);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
    }

    console.log('✅ [COORDENADOR-V2] Arquivo baixado, tamanho:', fileData.size);

    // Processar Excel diretamente (versão ultra-simplificada)
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      dense: true,
      cellText: false,
      cellDates: true
    });

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false
    });

    if (!jsonData || jsonData.length <= 1) {
      throw new Error('Arquivo vazio ou sem dados válidos');
    }

    // Headers na primeira linha
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);
    
    console.log(`📊 [COORDENADOR-V2] Processando ${dataRows.length} registros`);

    let processedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;

    // Processar em batches pequenos
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const recordsToInsert = [];

      for (const row of batch) {
        if (!row || (row as any[]).every(cell => !cell)) continue;

        const rowData = row as any[];
        const record: any = {
          arquivo_fonte: arquivo_fonte,
          periodo_referencia: periodo_referencia || 'jun/25',
          lote_upload: upload_id || crypto.randomUUID()
        };

        // Mapear colunas baseado na posição (padrão mobilemed)
        if (rowData.length >= 16) {
          record["EMPRESA"] = rowData[0] || null;
          record["NOME_PACIENTE"] = rowData[1] || null;
          record["CODIGO_PACIENTE"] = rowData[2] || null;
          record["ESTUDO_DESCRICAO"] = rowData[3] || null;
          record["ACCESSION_NUMBER"] = rowData[4] || null;
          record["MODALIDADE"] = rowData[5] || null;
          record["PRIORIDADE"] = rowData[6] || null;
          record["VALORES"] = parseFloat(rowData[7]) || 0;
          record["ESPECIALIDADE"] = rowData[8] || null;
          record["MEDICO"] = rowData[9] || null;
          record["DATA_REALIZACAO"] = rowData[10] || null;
          record["HORA_REALIZACAO"] = rowData[11] || null;
          record["DATA_LAUDO"] = rowData[12] || null;
          record["HORA_LAUDO"] = rowData[13] || null;
          record["DATA_PRAZO"] = rowData[14] || null;
          record["HORA_PRAZO"] = rowData[15] || null;
        }

        // Validação mínima
        if (record["EMPRESA"] && record["NOME_PACIENTE"]) {
          recordsToInsert.push(record);
        }
      }

      if (recordsToInsert.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('volumetria_mobilemed')
            .insert(recordsToInsert);

          if (insertError) {
            console.error(`❌ [COORDENADOR-V2] Erro no batch ${i}:`, insertError.message);
            errorCount += recordsToInsert.length;
          } else {
            insertedCount += recordsToInsert.length;
            console.log(`✅ [COORDENADOR-V2] Batch ${i}: ${recordsToInsert.length} registros`);
          }
        } catch (err) {
          console.error(`❌ [COORDENADOR-V2] Erro no insert:`, err);
          errorCount += recordsToInsert.length;
        }
      }

      processedCount += batch.length;
      
      // Pausa pequena entre batches
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Atualizar status do upload se foi fornecido
    if (upload_id) {
      await supabase
        .from('processamento_uploads')
        .update({
          status: errorCount > 0 ? 'erro_parcial' : 'sucesso',
          registros_processados: processedCount,
          registros_inseridos: insertedCount,
          registros_erro: errorCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', upload_id);
    }

    const result = {
      success: true,
      message: `Processamento completo: ${insertedCount} inseridos, ${errorCount} erros`,
      stats: {
        processados: processedCount,
        inseridos: insertedCount,
        erros: errorCount
      }
    };

    console.log('🎉 [COORDENADOR-V2] Concluído:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR-V2] Erro:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro no processamento coordenador simplificado'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});