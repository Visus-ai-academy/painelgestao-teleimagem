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

    // Verificar se existem planilhas
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

    // Headers na primeira linha - garantir que não seja null
    const headers = (jsonData[0] as any[]) || [];
    const dataRows = jsonData.slice(1).filter(row => Array.isArray(row) && row.length > 0);
    
    console.log(`📊 [COORDENADOR-V2] Processando ${dataRows.length} registros`);

    let processedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;

    // Processar em micro-batches ultra pequenos para economizar CPU
    const BATCH_SIZE = 15; // Reduzido ainda mais
    const MAX_BATCHES_PER_CYCLE = 20; // Processar no máximo 300 registros por ciclo
    
    let totalCycles = Math.ceil(dataRows.length / (BATCH_SIZE * MAX_BATCHES_PER_CYCLE));
    
    try {
      for (let cycle = 0; cycle < totalCycles; cycle++) {
        const cycleStart = cycle * BATCH_SIZE * MAX_BATCHES_PER_CYCLE;
        const cycleEnd = Math.min(cycleStart + (BATCH_SIZE * MAX_BATCHES_PER_CYCLE), dataRows.length);
        
        console.log(`🔄 [COORDENADOR-V4] Ciclo ${cycle + 1}/${totalCycles}: processando registros ${cycleStart} a ${cycleEnd}`);
        
        try {
          for (let i = cycleStart; i < cycleEnd; i += BATCH_SIZE) {
            let batch;
            let recordsToInsert;
            
            try {
              batch = dataRows.slice(i, Math.min(i + BATCH_SIZE, cycleEnd));
              if (!Array.isArray(batch)) {
                console.error(`❌ [COORDENADOR-V4] Batch não é array no índice ${i}`);
                continue;
              }
              
              recordsToInsert = [];

              for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
                try {
                  const row = batch[rowIndex];
                  
                  // Verificações super defensivas
                  if (row === null || row === undefined) continue;
                  if (!Array.isArray(row)) continue;
                  if (row.length === 0) continue;
                  if (row.every(cell => cell === null || cell === undefined || cell === '')) continue;

                  const rowData = row;
                  const record = {
                    arquivo_fonte: arquivo_fonte || 'volumetria_padrao',
                    periodo_referencia: periodo_referencia || 'jun/25',
                    lote_upload: upload_id || crypto.randomUUID()
                  };

                  // Mapear campos com máxima proteção
                  try {
                    if (rowData && Array.isArray(rowData) && rowData.length >= 8) {
                      // Função auxiliar para conversão segura
                      const safeString = (val) => {
                        if (val === null || val === undefined) return null;
                        const str = String(val).trim();
                        return str === '' ? null : str;
                      };
                      
                      record["EMPRESA"] = safeString(rowData[0]);
                      record["NOME_PACIENTE"] = safeString(rowData[1]);
                      record["CODIGO_PACIENTE"] = safeString(rowData[2]);
                      record["ESTUDO_DESCRICAO"] = safeString(rowData[3]);
                      record["ACCESSION_NUMBER"] = safeString(rowData[4]);
                      record["MODALIDADE"] = safeString(rowData[5]);
                      record["PRIORIDADE"] = safeString(rowData[6]);
                      
                      // Conversão super segura para número
                      try {
                        const valorRaw = rowData[7];
                        if (valorRaw === null || valorRaw === undefined) {
                          record["VALORES"] = 0;
                        } else {
                          const valorStr = String(valorRaw).replace(',', '.');
                          const valorNum = parseFloat(valorStr);
                          record["VALORES"] = isNaN(valorNum) ? 0 : valorNum;
                        }
                      } catch (valorErr) {
                        console.error(`❌ [COORDENADOR-V4] Erro conversão valor linha ${i + rowIndex}:`, valorErr);
                        record["VALORES"] = 0;
                      }
                      
                      // Campos opcionais com proteção máxima
                      if (rowData.length >= 16) {
                        try {
                          record["ESPECIALIDADE"] = safeString(rowData[8]);
                          record["MEDICO"] = safeString(rowData[9]);
                          record["DATA_REALIZACAO"] = safeString(rowData[10]);
                          record["HORA_REALIZACAO"] = safeString(rowData[11]);
                          record["DATA_LAUDO"] = safeString(rowData[12]);
                          record["HORA_LAUDO"] = safeString(rowData[13]);
                          record["DATA_PRAZO"] = safeString(rowData[14]);
                          record["HORA_PRAZO"] = safeString(rowData[15]);
                        } catch (camposErr) {
                          console.error(`❌ [COORDENADOR-V4] Erro campos opcionais linha ${i + rowIndex}:`, camposErr);
                        }
                      }
                    }

                    // Validação mínima ultra defensiva
                    if (record["EMPRESA"] && record["NOME_PACIENTE"]) {
                      recordsToInsert.push(record);
                    }
                    
                  } catch (recordErr) {
                    console.error(`❌ [COORDENADOR-V4] Erro processamento record linha ${i + rowIndex}:`, recordErr);
                    continue;
                  }
                  
                } catch (rowErr) {
                  console.error(`❌ [COORDENADOR-V4] Erro processamento row ${rowIndex}:`, rowErr);
                  continue;
                }
              }

              // Insert com proteção máxima
              if (recordsToInsert && Array.isArray(recordsToInsert) && recordsToInsert.length > 0) {
                try {
                  const { error: insertError } = await supabase
                    .from('volumetria_mobilemed')
                    .insert(recordsToInsert);

                  if (insertError) {
                    console.error(`❌ [COORDENADOR-V4] Erro no batch ${i}:`, insertError.message);
                    errorCount += recordsToInsert.length;
                  } else {
                    insertedCount += recordsToInsert.length;
                  }
                } catch (insertErr) {
                  console.error(`❌ [COORDENADOR-V4] Erro no insert batch ${i}:`, insertErr);
                  errorCount += recordsToInsert.length;
                }
              }

              processedCount += batch.length;
              
            } catch (batchErr) {
              console.error(`❌ [COORDENADOR-V4] Erro no batch ${i}:`, batchErr);
              errorCount += BATCH_SIZE;
            } finally {
              // Limpeza agressiva de memória
              batch = null;
              recordsToInsert = null;
              
              // Pausa entre batches
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        } catch (cycleErr) {
          console.error(`❌ [COORDENADOR-V4] Erro no ciclo ${cycle}:`, cycleErr);
        } finally {
          // Pausa maior entre ciclos
          if (cycle < totalCycles - 1) {
            console.log(`⏸️ [COORDENADOR-V4] Pausa entre ciclos... ${insertedCount} inseridos até agora`);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
    } catch (processErr) {
      console.error(`💥 [COORDENADOR-V4] Erro no processamento geral:`, processErr);
      throw processErr;
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