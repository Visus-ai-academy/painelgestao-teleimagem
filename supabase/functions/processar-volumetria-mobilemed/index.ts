import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VolumetriaRecord {
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE?: string;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string;
  DATA_REALIZACAO?: Date;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: Date;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: Date;
  HORA_LAUDO?: string;
  DATA_PRAZO?: Date;
  HORA_PRAZO?: string;
  STATUS?: string;
  DATA_REASSINATURA?: Date;
  HORA_REASSINATURA?: string;
  MEDICO_REASSINATURA?: string;
  SEGUNDA_ASSINATURA?: string;
  POSSUI_IMAGENS_CHAVE?: string;
  IMAGENS_CHAVES?: number;
  IMAGENS_CAPTURADAS?: number;
  CODIGO_INTERNO?: number;
  DIGITADOR?: string;
  COMPLEMENTAR?: string;
  arquivo_fonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao';
  lote_upload?: string;
  periodo_referencia?: string;
}

function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const cleanDate = dateStr.trim();
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) return null;
    
    let [, day, month, year] = match;
    
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) return null;
    
    const [, hours, minutes, seconds = '00'] = match;
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) return null;
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    return null;
  }
}

function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    return isNaN(numValue) ? null : Math.floor(numValue);
  } catch (error) {
    return null;
  }
}

function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao', loteUpload: string, periodoReferencia: string): VolumetriaRecord | null {
  try {
    if (!row || typeof row !== 'object') return null;

    const empresa = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    const record: VolumetriaRecord = {
      EMPRESA: String(empresa).trim(),
      NOME_PACIENTE: String(nomePaciente).trim(),
      arquivo_fonte: arquivoFonte,
      lote_upload: loteUpload,
      periodo_referencia: periodoReferencia,
      
      CODIGO_PACIENTE: safeString(row['CODIGO_PACIENTE']),
      ESTUDO_DESCRICAO: safeString(row['ESTUDO_DESCRICAO']),
      ACCESSION_NUMBER: safeString(row['ACCESSION_NUMBER']),
      MODALIDADE: safeString(row['MODALIDADE']),
      PRIORIDADE: safeString(row['PRIORIDADE']),
      ESPECIALIDADE: safeString(row['ESPECIALIDADE']),
      MEDICO: safeString(row['MEDICO']),
      DUPLICADO: safeString(row['DUPLICADO']),
      STATUS: safeString(row['STATUS']),
      MEDICO_REASSINATURA: safeString(row['MEDICO_REASSINATURA']),
      SEGUNDA_ASSINATURA: safeString(row['SEGUNDA_ASSINATURA']),
      POSSUI_IMAGENS_CHAVE: safeString(row['POSSUI_IMAGENS_CHAVE']),
      DIGITADOR: safeString(row['DIGITADOR']),
      COMPLEMENTAR: safeString(row['COMPLEMENTAR']),
      
      VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    return record;
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return null;
  }
}

// Função para processamento com controle de lote
async function processFileWithBatchControl(jsonData: any[], arquivo_fonte: string, uploadLogId: string, supabaseClient: any, fileName: string, periodo: any) {
  console.log(`=== PROCESSAMENTO COM CONTROLE DE LOTE ===`);
  console.log(`Total de registros: ${jsonData.length}`);
  console.log(`Arquivo: ${fileName}`);
  console.log(`Período: ${JSON.stringify(periodo)}`);
  
  if (jsonData.length === 0) {
    throw new Error('Arquivo Excel está vazio');
  }

  // Gerar identificadores únicos para este lote
  const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLogId.substring(0, 8)}`;
  const periodoReferencia = periodo ? `${periodo.mes}/${periodo.ano}` : new Date().toISOString().substring(0, 7);

  console.log(`🏷️ Lote: ${loteUpload}`);
  console.log(`📅 Período: ${periodoReferencia}`);

  // IMPORTANTE: Limpar dados existentes do mesmo arquivo_fonte e período para evitar acúmulo
  try {
    console.log(`🧹 Limpando dados anteriores: ${arquivo_fonte} - ${periodoReferencia}`);
    const { count: deletedCount } = await supabaseClient
      .from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('periodo_referencia', periodoReferencia);
    
    console.log(`🗑️ Removidos ${deletedCount || 0} registros anteriores`);
  } catch (cleanupError) {
    console.error('⚠️ Erro na limpeza (continuando):', cleanupError);
  }

  // Configurações otimizadas
  const CHUNK_SIZE = Math.min(200, jsonData.length); // Chunks ainda menores
  const BATCH_SIZE = 25;  // Batches muito pequenos para inserção rápida
  const MAX_EXECUTION_TIME = 5000; // 5 segundos de segurança máxima
  
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  // Processar em chunks pequenos
  for (let chunkStart = 0; chunkStart < jsonData.length; chunkStart += CHUNK_SIZE) {
    // Controle rigoroso de tempo
    const currentTime = Date.now();
    if (currentTime - startTime > MAX_EXECUTION_TIME) {
      console.log(`⏰ TIMEOUT após ${totalProcessed} registros em ${currentTime - startTime}ms`);
      break;
    }

    const chunk = jsonData.slice(chunkStart, chunkStart + CHUNK_SIZE);
    const chunkNumber = Math.floor(chunkStart / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(jsonData.length / CHUNK_SIZE);
    
    console.log(`📦 Chunk ${chunkNumber}/${totalChunks}: ${chunk.length} registros`);

    // Processamento das linhas
    const allRecords: VolumetriaRecord[] = [];
    
    for (const row of chunk) {
      try {
        const record = processRow(row, arquivo_fonte, loteUpload, periodoReferencia);
        if (record && record.EMPRESA && record.NOME_PACIENTE) {
          allRecords.push(record);
        } else {
          totalErrors++;
        }
      } catch (error) {
        totalErrors++;
      }
      totalProcessed++;
    }
    
    // Inserção em micro-batches
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Erro batch ${i}:`, insertError.message);
          totalErrors += batch.length;
        } else {
          totalInserted += batch.length;
          console.log(`✅ Batch ${i}: ${batch.length} inseridos`);
        }
      } catch (batchErr) {
        console.error(`❌ Erro crítico batch ${i}:`, batchErr);
        totalErrors += batch.length;
      }
    }

    // Update de progresso esporádico
    if (chunkNumber % 3 === 0 || chunkNumber === totalChunks) {
      try {
        await supabaseClient
          .from('processamento_uploads')
          .update({ 
            registros_processados: totalProcessed,
            registros_inseridos: totalInserted,
            registros_erro: totalErrors,
            detalhes_erro: JSON.stringify({
              status: 'Processando Rápido',
              progresso: `${Math.round((totalProcessed / jsonData.length) * 100)}%`,
              chunk: `${chunkNumber}/${totalChunks}`,
              lote: loteUpload,
              periodo: periodoReferencia,
              tempo: `${Math.round((Date.now() - startTime) / 1000)}s`
            })
          })
          .eq('id', uploadLogId);
      } catch (updateErr) {
        // Ignorar para ganhar tempo
      }
    }
  }

  const executionTime = Date.now() - startTime;
  console.log(`⚡ Processamento: ${totalInserted} inseridos, ${totalErrors} erros em ${executionTime}ms`);
  
  // Aplicar regras apenas se necessário e dentro do tempo
  let registrosAtualizadosDePara = 0;
  if (totalInserted > 0 && executionTime < MAX_EXECUTION_TIME - 1000) {
    try {
      console.log('🔧 Aplicando regras rápidas...');
      
      if (arquivo_fonte === 'volumetria_fora_padrao') {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_valores_de_para');
        registrosAtualizadosDePara += deParaResult?.registros_atualizados || 0;
        console.log(`✅ De-Para valores: ${deParaResult?.registros_atualizados || 0}`);
      }

      const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      registrosAtualizadosDePara += prioridadeResult?.registros_atualizados || 0;
      console.log(`✅ De-Para prioridade: ${prioridadeResult?.registros_atualizados || 0}`);
      
    } catch (regraErr) {
      console.error('⚠️ Erro regras:', regraErr);
    }
  }

  // Status final
  const isComplete = totalProcessed >= jsonData.length;
  const finalStatus = isComplete 
    ? (totalInserted > 0 ? 'concluido' : 'erro')
    : 'processamento_parcial';

  await supabaseClient
    .from('processamento_uploads')
    .update({
      status: finalStatus,
      registros_processados: totalProcessed,
      registros_inseridos: totalInserted,
      registros_atualizados: registrosAtualizadosDePara,
      registros_erro: totalErrors,
      completed_at: isComplete ? new Date().toISOString() : null,
      detalhes_erro: JSON.stringify({
        status: isComplete ? 'Concluído' : 'Parcial - Timeout',
        arquivo_tamanho: jsonData.length,
        processados: totalProcessed,
        inseridos: totalInserted,
        atualizados: registrosAtualizadosDePara,
        erros: totalErrors,
        tempo_ms: executionTime,
        lote_upload: loteUpload,
        periodo_referencia: periodoReferencia,
        completo: isComplete,
        dados_limpos: true
      })
    })
    .eq('id', uploadLogId);

  return {
    totalProcessed,
    totalInserted,
    totalErrors,
    registrosAtualizadosDePara,
    isComplete,
    executionTime,
    loteUpload,
    periodoReferencia
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo } = await req.json();

    console.log('=== PROCESSAR VOLUMETRIA MOBILEMED ===');
    console.log('Arquivo:', file_path);
    console.log('Fonte:', arquivo_fonte);

    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte são obrigatórios');
    }

    if (!['data_laudo', 'data_exame', 'volumetria_fora_padrao'].includes(arquivo_fonte)) {
      throw new Error('arquivo_fonte deve ser "data_laudo", "data_exame" ou "volumetria_fora_padrao"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path,
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        periodo_referencia: periodo ? `${periodo.mes}/${periodo.ano}` : null
      })
      .select()
      .single();

    if (logError) {
      throw new Error('Erro ao criar log de upload');
    }

    console.log('Log criado:', uploadLog.id);

    // Baixar arquivo
    console.log('Baixando arquivo...');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    console.log('Arquivo baixado, tamanho:', fileData.size);

    // Ler Excel com máxima otimização
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellDates: false,
      cellNF: false, 
      cellHTML: false,
      dense: true,
      sheetRows: 50000, // Limitar para evitar overflow
      bookSST: false
    });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      raw: true,
      dateNF: 'dd/mm/yyyy',
      blankrows: false
    });
    
    console.log(`Dados extraídos: ${jsonData.length} linhas`);
    
    // Processar com controle de lote
    const resultado = await processFileWithBatchControl(
      jsonData, 
      arquivo_fonte, 
      uploadLog.id, 
      supabaseClient, 
      file_path, 
      periodo
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: resultado.isComplete ? "Processamento concluído" : "Processamento parcial (timeout)",
        upload_log_id: uploadLog.id,
        stats: {
          total_arquivo: jsonData.length,
          processados: resultado.totalProcessed,
          inseridos: resultado.totalInserted,
          atualizados: resultado.registrosAtualizadosDePara,
          erros: resultado.totalErrors,
          completo: resultado.isComplete,
          tempo_ms: resultado.executionTime,
          lote_upload: resultado.loteUpload,
          periodo_referencia: resultado.periodoReferencia
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});