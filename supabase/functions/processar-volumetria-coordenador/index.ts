import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 COORDENADOR STREAMING - Processamento em background para evitar timeout
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo_referencia, upload_id } = await req.json();
    
    console.log('🎯 [COORDENADOR-STREAM] Iniciando processamento streaming:', {
      file_path,
      arquivo_fonte,
      periodo_referencia,
      upload_id
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Função de processamento em background
    async function processInBackground() {
      let processedCount = 0;
      let insertedCount = 0;
      let errorCount = 0;

      try {
        // Baixar arquivo
        console.log('📥 [STREAM-BG] Baixando arquivo:', file_path);
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('uploads')
          .download(file_path);

        if (downloadError || !fileData) {
          throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
        }

        console.log('✅ [STREAM-BG] Arquivo baixado, tamanho:', fileData.size);

        // Processar Excel
        const arrayBuffer = await fileData.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          dense: true,
          cellText: false,
          cellDates: true
        });

        if (!workbook?.Sheets || !workbook?.SheetNames?.length) {
          throw new Error('Arquivo Excel não contém planilhas válidas');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
          throw new Error('Primeira planilha não encontrada');
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false
        });

        if (!Array.isArray(jsonData) || jsonData.length <= 1) {
          throw new Error('Arquivo vazio ou sem dados válidos');
        }

        const dataRows = jsonData.slice(1).filter(row => 
          Array.isArray(row) && 
          row.length > 0 && 
          !row.every(cell => cell === null || cell === undefined || cell === '')
        );
        
        console.log(`📊 [STREAM-BG] Processando ${dataRows.length} registros em micro-batches`);

        // Processamento em micro-batches ultra pequenos
        const MICRO_BATCH_SIZE = 3; // Apenas 3 registros por vez
        const PAUSE_BETWEEN_BATCHES = 100; // 100ms entre batches
        
        for (let i = 0; i < dataRows.length; i += MICRO_BATCH_SIZE) {
          const batch = dataRows.slice(i, Math.min(i + MICRO_BATCH_SIZE, dataRows.length));
          
          try {
            const recordsToInsert = [];

            for (const row of batch) {
              if (!Array.isArray(row) || row.length < 8) continue;
              
              try {
                const record = {
                  arquivo_fonte: arquivo_fonte || 'volumetria_padrao',
                  periodo_referencia: periodo_referencia || 'jun/25',
                  lote_upload: upload_id || crypto.randomUUID(),
                  EMPRESA: String(row[0] || '').trim() || null,
                  NOME_PACIENTE: String(row[1] || '').trim() || null,
                  CODIGO_PACIENTE: String(row[2] || '').trim() || null,
                  ESTUDO_DESCRICAO: String(row[3] || '').trim() || null,
                  ACCESSION_NUMBER: String(row[4] || '').trim() || null,
                  MODALIDADE: String(row[5] || '').trim() || null,
                  PRIORIDADE: String(row[6] || '').trim() || null
                };

                // Conversão super segura do valor
                try {
                  const valorRaw = row[7];
                  if (valorRaw === null || valorRaw === undefined || valorRaw === '') {
                    record.VALORES = 0;
                  } else {
                    const valorStr = String(valorRaw).replace(',', '.');
                    const valorNum = parseFloat(valorStr);
                    record.VALORES = isNaN(valorNum) ? 0 : valorNum;
                  }
                } catch {
                  record.VALORES = 0;
                }

                // Campos opcionais se existirem
                if (row.length >= 16) {
                  record.ESPECIALIDADE = String(row[8] || '').trim() || null;
                  record.MEDICO = String(row[9] || '').trim() || null;
                  record.DATA_REALIZACAO = String(row[10] || '').trim() || null;
                  record.HORA_REALIZACAO = String(row[11] || '').trim() || null;
                  record.DATA_LAUDO = String(row[12] || '').trim() || null;
                  record.HORA_LAUDO = String(row[13] || '').trim() || null;
                  record.DATA_PRAZO = String(row[14] || '').trim() || null;
                  record.HORA_PRAZO = String(row[15] || '').trim() || null;
                }

                // Validação mínima
                if (record.EMPRESA && record.NOME_PACIENTE) {
                  recordsToInsert.push(record);
                }
              } catch (rowError) {
                console.error(`❌ [STREAM-BG] Erro processamento row:`, rowError);
                continue;
              }
            }

            // Insert dos registros válidos
            if (recordsToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('volumetria_mobilemed')
                .insert(recordsToInsert);

              if (insertError) {
                console.error(`❌ [STREAM-BG] Erro no insert:`, insertError.message);
                errorCount += recordsToInsert.length;
              } else {
                insertedCount += recordsToInsert.length;
                console.log(`✅ [STREAM-BG] Inseridos ${recordsToInsert.length} registros (total: ${insertedCount})`);
              }
            }

            processedCount += batch.length;

            // Pausa entre micro-batches para evitar sobrecarga
            await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BATCHES));
            
          } catch (batchError) {
            console.error(`❌ [STREAM-BG] Erro no batch ${i}:`, batchError);
            errorCount += batch.length;
          }
        }

        // Atualizar status final
        if (upload_id) {
          await supabase
            .from('processamento_uploads')
            .update({
              status: errorCount > insertedCount / 2 ? 'erro_parcial' : 'sucesso',
              registros_processados: processedCount,
              registros_inseridos: insertedCount,
              registros_erro: errorCount,
              completed_at: new Date().toISOString()
            })
            .eq('id', upload_id);
        }

        console.log('🎉 [STREAM-BG] Processamento concluído:', {
          processados: processedCount,
          inseridos: insertedCount,
          erros: errorCount
        });

      } catch (bgError) {
        console.error('💥 [STREAM-BG] Erro no processamento:', bgError.message);
        
        // Atualizar como erro
        if (upload_id) {
          await supabase
            .from('processamento_uploads')
            .update({
              status: 'erro',
              detalhes_erro: {
                erro: bgError.message,
                etapa: 'processamento_background',
                versao: 'streaming_v1'
              },
              completed_at: new Date().toISOString()
            })
            .eq('id', upload_id);
        }
      }
    }

    // Iniciar processamento em background (não bloqueia a resposta)
    if (EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(processInBackground());
    } else {
      // Fallback se waitUntil não estiver disponível
      processInBackground().catch(err => 
        console.error('Erro no processamento background:', err)
      );
    }

    // Atualizar status como processando
    if (upload_id) {
      await supabase
        .from('processamento_uploads')
        .update({
          status: 'processando',
          detalhes_erro: null
        })
        .eq('id', upload_id);
    }

    // Retornar resposta imediata
    const result = {
      success: true,
      message: 'Processamento iniciado em background',
      background: true,
      upload_id
    };

    console.log('🚀 [COORDENADOR-STREAM] Resposta imediata enviada');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [COORDENADOR-STREAM] Erro:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro no processamento streaming'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});