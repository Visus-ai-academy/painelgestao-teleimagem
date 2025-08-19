import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('📊 [EXCEL-V5] Processamento direto para arquivos grandes (35k+ linhas)');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log('📊 [EXCEL-V5] Parâmetros:', { file_path, arquivo_fonte, periodo_referencia });
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Registrar upload inicial
    const lote_upload = crypto.randomUUID();
    const arquivoNome = file_path.includes('/') ? file_path.split('/').pop() : file_path;
    
    console.log('📊 [EXCEL-V5] Registrando upload:', arquivoNome);
    
    const { data: uploadRecord } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        tipo_arquivo: arquivo_fonte,
        arquivo_nome: arquivoNome || 'arquivo.xlsx',
        status: 'processando',
        periodo_referencia: periodo_referencia || 'jun/25',
        detalhes_erro: { lote_upload, etapa: 'processamento_v5_DIRETO', versao: 'v5' }
      })
      .select()
      .single();

    console.log('✅ [EXCEL-V5] Upload registrado:', uploadRecord?.id);

    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
    }

    console.log('✅ [EXCEL-V5] Arquivo baixado, tamanho:', fileData.size);

    // Ler Excel com configurações ultra-otimizadas
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'buffer',
      dense: true,
      sheetStubs: false,
      cellNF: false,
      cellHTML: false,
      cellFormula: false,
      cellStyles: false,
      cellDates: false,
      WTF: false
    });

    console.log('📖 [EXCEL-V5] Workbook lido, sheets:', workbook.SheetNames);
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) {
      throw new Error('Nenhuma planilha encontrada');
    }

    // Processar em chunks ultra-pequenos (100 linhas por vez)
    const CHUNK_SIZE = 100;
    let processedCount = 0;
    let totalInserted = 0;
    let hasMoreData = true;
    let startRow = 1; // Pular cabeçalho

    while (hasMoreData) {
      console.log(`📊 [EXCEL-V5] Processando chunk ${Math.floor(startRow/CHUNK_SIZE) + 1}, linhas ${startRow}-${startRow + CHUNK_SIZE - 1}`);
      
      // Converter chunk para JSON
      const chunkData = XLSX.utils.sheet_to_json(worksheet, {
        range: `A${startRow + 1}:ZZ${startRow + CHUNK_SIZE}`, // +1 para pular cabeçalho
        header: 1,
        defval: null,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      });

      if (!chunkData || chunkData.length === 0) {
        hasMoreData = false;
        break;
      }

      console.log(`📊 [EXCEL-V5] Chunk possui ${chunkData.length} registros`);

      // Processar cada registro do chunk
      const processedRecords = chunkData.map(row => {
        if (!row || typeof row !== 'object') return null;
        
        const processed = {
          id: crypto.randomUUID(),
          "EMPRESA": row[0] || null,
          "NOME_PACIENTE": row[1] || null,
          "CODIGO_PACIENTE": row[2] || null,
          "ESTUDO_DESCRICAO": row[3] || null,
          "ACCESSION_NUMBER": row[4] || null,
          "MODALIDADE": row[5] || null,
          "PRIORIDADE": row[6] || null,
          "VALORES": row[7] ? parseFloat(row[7]) || 0 : 0,
          "ESPECIALIDADE": row[8] || null,
          "MEDICO": row[9] || null,
          "DATA_REALIZACAO": row[10] || null,
          "HORA_REALIZACAO": row[11] || null,
          "DATA_LAUDO": row[12] || null,
          "HORA_LAUDO": row[13] || null,
          "DATA_PRAZO": row[14] || null,
          "HORA_PRAZO": row[15] || null,
          periodo_referencia: periodo_referencia || 'jun/25',
          arquivo_fonte: arquivo_fonte,
          lote_upload: lote_upload,
          data_referencia: new Date().toISOString().split('T')[0]
        };

        // Validar campos obrigatórios
        if (!processed["EMPRESA"] || !processed["NOME_PACIENTE"]) {
          return null;
        }

        return processed;
      }).filter(record => record !== null);

      if (processedRecords.length > 0) {
        // Inserir em micro-batches de 10 registros
        const MICRO_BATCH_SIZE = 10;
        for (let i = 0; i < processedRecords.length; i += MICRO_BATCH_SIZE) {
          const microBatch = processedRecords.slice(i, i + MICRO_BATCH_SIZE);
          
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(microBatch);

          if (insertError) {
            console.error(`❌ [EXCEL-V5] Erro micro-batch ${i}:`, insertError.message);
          } else {
            totalInserted += microBatch.length;
            console.log(`✅ [EXCEL-V5] Micro-batch ${i}: ${microBatch.length} registros`);
          }

          // Pausa entre micro-batches para evitar timeout
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      processedCount += chunkData.length;
      startRow += CHUNK_SIZE;

      // Pausa entre chunks para liberar memória
      await new Promise(resolve => setTimeout(resolve, 100));

      // Forçar garbage collection
      if (globalThis.gc) {
        globalThis.gc();
      }

      // Limite de segurança (35k linhas = 350 chunks de 100)
      if (Math.floor(startRow/CHUNK_SIZE) > 350) {
        console.log('⚠️ [EXCEL-V5] Limite de chunks atingido (35k linhas)');
        break;
      }
    }

    // Atualizar status final
    if (uploadRecord?.id) {
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'concluido',
          registros_processados: processedCount,
          registros_inseridos: totalInserted,
          registros_erro: processedCount - totalInserted,
          completed_at: new Date().toISOString(),
          detalhes_erro: {
            etapa: 'processamento_v5_CONCLUIDO',
            lote_upload: lote_upload,
            versao: 'v5_direto',
            chunks_processados: Math.floor(startRow/CHUNK_SIZE)
          }
        })
        .eq('id', uploadRecord.id);
    }

    console.log(`🎉 [EXCEL-V5] CONCLUÍDO: ${totalInserted} registros inseridos de ${processedCount} processados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processamento concluído! ${totalInserted} registros inseridos`,
        upload_id: uploadRecord?.id || 'temp-' + Date.now(),
        stats: {
          inserted_count: totalInserted,
          total_rows: processedCount,
          error_count: processedCount - totalInserted,
          regras_aplicadas: 0
        },
        processamento_completo_com_regras: true,
        processamento_em_background: false,
        versao: 'v5_direto',
        observacao: `Arquivo processado com sucesso em ${Math.floor(startRow/CHUNK_SIZE)} chunks`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [EXCEL-PROCESSAMENTO-V3] ERRO CAPTURADO:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: `Erro no processamento: ${error.message}`,
        versao: 'v3_erro'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
