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
  arquivo_fonte: 'data_laudo' | 'data_exame' | 'volumetria_padrao' | 'volumetria_fora_padrao' | 'volumetria_padrao_retroativo' | 'volumetria_fora_padrao_retroativo' | 'volumetria_onco_padrao';
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

function processRow(row: any, arquivoFonte: string, loteUpload: string, periodoReferencia: string): VolumetriaRecord | null {
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
      arquivo_fonte: arquivoFonte as any,
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

// Função para processamento com controle de lote otimizado para arquivos grandes
async function processFileWithBatchControl(jsonData: any[], arquivo_fonte: string, uploadLogId: string, supabaseClient: any, fileName: string, periodo: any) {
  console.log(`=== PROCESSAMENTO COM CONTROLE DE LOTE ===`);
  console.log(`Arquivo: ${fileName}`);
  console.log(`Fonte: ${arquivo_fonte}`);
  console.log(`Total de registros: ${jsonData.length}`);
  console.log(`Período: ${JSON.stringify(periodo)}`);
  
  if (jsonData.length === 0) {
    throw new Error('Arquivo Excel está vazio');
  }

  // Gerar identificadores únicos para este lote
  const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLogId.substring(0, 8)}`;
  const periodoReferencia = periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);

  console.log(`🏷️ Lote: ${loteUpload}`);
  console.log(`📅 Período: ${periodoReferencia}`);

  // Constantes otimizadas para arquivos grandes
  const LARGE_FILE_THRESHOLD = 3000; // Reduzido ainda mais para ser ultra conservativo
  const isLargeFile = jsonData.length > LARGE_FILE_THRESHOLD;
  
  // Configuração ultra conservativa para arquivos grandes
  const CHUNK_SIZE = isLargeFile ? 25 : 250;           // Chunks ainda menores para arquivos grandes
  const BATCH_SIZE = isLargeFile ? 5 : 20;             // Batches muito pequenos
  const MAX_EXECUTION_TIME = isLargeFile ? 45000 : 30000; // Tempo reduzido para evitar timeout
  const PROGRESS_UPDATE_INTERVAL = isLargeFile ? 10 : 3;    // Updates menos frequentes para economizar tempo

  console.log(`📊 Arquivo ${isLargeFile ? 'GRANDE' : 'normal'}: ${jsonData.length} registros`);
  console.log(`⚙️ Config: Chunk=${CHUNK_SIZE}, Batch=${BATCH_SIZE}, Timeout=${MAX_EXECUTION_TIME}ms`);

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

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  // Processar em chunks pequenos para evitar overflow de memória
  for (let chunkStart = 0; chunkStart < jsonData.length; chunkStart += CHUNK_SIZE) {
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    
    // Controle rigoroso de timeout
    if (elapsedTime > MAX_EXECUTION_TIME) {
      console.log(`⏰ TIMEOUT após ${totalProcessed} registros em ${elapsedTime}ms`);
      break;
    }

    const chunk = jsonData.slice(chunkStart, chunkStart + CHUNK_SIZE);
    const chunkNumber = Math.floor(chunkStart / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(jsonData.length / CHUNK_SIZE);
    
    console.log(`📦 Chunk ${chunkNumber}/${totalChunks}: ${chunk.length} registros (${Math.round(elapsedTime/1000)}s)`);

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
    
    // Inserção em micro-batches para reduzir uso de memória
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

    // Update de progresso otimizado
    if (chunkNumber % PROGRESS_UPDATE_INTERVAL === 0 || chunkNumber === totalChunks) {
      try {
        const progressPercentage = Math.round((totalProcessed / jsonData.length) * 100);
        const elapsedSeconds = Math.round(elapsedTime / 1000);
        
        await supabaseClient
          .from('processamento_uploads')
          .update({ 
            registros_processados: totalProcessed,
            registros_inseridos: totalInserted,
            registros_erro: totalErrors,
            detalhes_erro: JSON.stringify({
              status: isLargeFile ? 'Processando Arquivo Grande' : 'Processando Rápido',
              progresso: `${progressPercentage}%`,
              chunk: `${chunkNumber}/${totalChunks}`,
              lote: loteUpload,
              periodo: periodoReferencia,
              tempo: `${elapsedSeconds}s`,
              otimizado: true
            })
          })
          .eq('id', uploadLogId);
      } catch (updateErr) {
        // Ignorar erros de update para não atrapalhar o processamento
      }
    }
    
    // Forçar garbage collection liberando a referência do array
    allRecords.length = 0;
  }

  const executionTime = Date.now() - startTime;
  console.log(`⚡ Processamento: ${totalInserted} inseridos, ${totalErrors} erros em ${executionTime}ms`);
  
  // Aplicar regras apenas se tiver tempo suficiente e não for arquivo muito grande
  let registrosAtualizadosDePara = 0;
  const hasTimeForRules = executionTime < (MAX_EXECUTION_TIME - 8000);
  const shouldApplyRules = totalInserted > 0 && hasTimeForRules && !isLargeFile;
  
  if (shouldApplyRules) {
    try {
      console.log('🔧 Aplicando regras rápidas...');
      
      // Aplicar de-para de valores para todos os arquivos de volumetria
      if (arquivo_fonte.includes('volumetria')) {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivo_fonte 
        });
        registrosAtualizadosDePara += deParaResult?.registros_atualizados || 0;
        console.log(`✅ De-Para valores automático: ${deParaResult?.registros_atualizados || 0}`);
      }

      const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      registrosAtualizadosDePara += prioridadeResult?.registros_atualizados || 0;
      console.log(`✅ De-Para prioridade: ${prioridadeResult?.registros_atualizados || 0}`);
    } catch (rulesError) {
      console.log(`⚠️ Erro nas regras (ignorado): ${rulesError.message}`);
    }
  } else if (isLargeFile) {
    console.log('⏭️ Pulando aplicação de regras para arquivo grande - será feito em background');
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
    console.log('📥 Recebendo request...');
    const requestData = await req.json();
    console.log('📋 Request data:', JSON.stringify(requestData));
    
    const { file_path, arquivo_fonte, periodo } = requestData;

    console.log('=== PROCESSAR VOLUMETRIA MOBILEMED ===');
    console.log('Arquivo:', file_path);
    console.log('Fonte:', arquivo_fonte);
    console.log('Período:', JSON.stringify(periodo));

    if (!file_path || !arquivo_fonte) {
      console.error('❌ Parâmetros obrigatórios ausentes');
      throw new Error('file_path e arquivo_fonte são obrigatórios');
    }

    const validSources = ['data_laudo', 'data_exame', 'volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'];
    if (!validSources.includes(arquivo_fonte)) {
      console.error('❌ Fonte inválida:', arquivo_fonte);
      throw new Error(`arquivo_fonte deve ser um dos: ${validSources.join(', ')}`);
    }

    console.log('✅ Validações básicas OK');

    console.log('🔧 Criando cliente Supabase...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('✅ Cliente Supabase criado');

    // Criar log de upload
    console.log('📝 Criando log de upload...');
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
        periodo_referencia: periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : null
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Erro ao criar log:', logError);
      throw new Error(`Erro ao criar log de upload: ${logError.message}`);
    }

    console.log('✅ Log criado:', uploadLog.id);

    // Baixar arquivo
    console.log('⬇️ Baixando arquivo do storage...');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('❌ Erro no download:', downloadError);
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    console.log('✅ Arquivo baixado, tamanho:', fileData.size);

    // Ler Excel COMPLETO - sem limitações
    console.log('📖 Lendo arquivo Excel COMPLETO...');
    const arrayBuffer = await fileData.arrayBuffer();
    console.log('✅ ArrayBuffer criado, tamanho:', arrayBuffer.byteLength);
    
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellDates: false,
      cellNF: false, 
      cellHTML: false,
      dense: true,
      // REMOVIDO: sheetRows - agora lê TODAS as linhas
      bookSST: false
    });
    
    if (!workbook.SheetNames.length) {
      console.error('❌ Arquivo sem planilhas');
      throw new Error('Arquivo Excel não possui planilhas');
    }

    console.log('✅ Workbook criado, planilhas:', workbook.SheetNames);

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log('📊 Convertendo planilha COMPLETA para JSON...');
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      raw: true,
      dateNF: 'dd/mm/yyyy',
      blankrows: false
    });
    
    console.log(`✅ Dados extraídos: ${jsonData.length} linhas (ARQUIVO COMPLETO)`);
    
    console.log(`🚀 Processando TODOS os ${jsonData.length} registros de uma vez`);
    
    // Processar o arquivo COMPLETO sem limitações
    const resultado = await processFileWithBatchControl(
      jsonData, 
      arquivo_fonte, 
      uploadLog.id, 
      supabaseClient, 
      file_path, 
      periodo
    );

    console.log('✅ Processamento concluído:', resultado);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: resultado.isComplete ? "Processamento concluído" : "Processamento parcial (timeout)",
        upload_log_id: uploadLog.id,
        totalProcessed: resultado.totalProcessed,
        totalInserted: resultado.totalInserted,
        totalErrors: resultado.totalErrors,
        registrosAtualizadosDePara: resultado.registrosAtualizadosDePara,
        isComplete: resultado.isComplete,
        executionTime: resultado.executionTime,
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
    console.error('💥 ERRO CRÍTICO na função:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});