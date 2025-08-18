import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingState {
  upload_log_id: string;
  file_path: string;
  arquivo_fonte: string;
  periodo?: any;
  total_rows: number;
  processed_rows: number;
  current_batch: number;
  lote_upload: string;
  periodo_referencia: string;
  batch_size: number;
}

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
  arquivo_fonte: string;
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

    const empresaOriginal = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    // REMOVIDO: Não excluir registros por campos vazios - tratar como string vazia se necessário

    // REGRA: Excluir clientes com "_local" no nome (maiúscula ou minúscula)
    if (empresaOriginal.toLowerCase().includes('_local')) {
      return null;
    }

    // Não aplicar limpeza aqui pois processRow é síncrono - será aplicado via trigger SQL
    const empresa = empresaOriginal.trim();

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    // Função para limpar códigos X1-X9 dos nomes de exames
    const cleanExameName = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      
      let cleanName = String(value).trim();
      // Remove códigos X1, X2, X3, X4, X5, X6, X7, X8, X9
      cleanName = cleanName.replace(/\s+X[1-9]\b/gi, '');
      // Remove códigos XE também
      cleanName = cleanName.replace(/\s+XE\b/gi, '');
      // Remove múltiplos espaços que podem ter sobrado
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      return cleanName || undefined;
    };

    const record: VolumetriaRecord = {
      EMPRESA: String(empresa || 'SEM_EMPRESA').trim(), // CORREÇÃO: Não deixar vazio
      NOME_PACIENTE: String(nomePaciente || 'SEM_NOME').trim(), // CORREÇÃO: Não deixar vazio
      arquivo_fonte: arquivoFonte,
      lote_upload: loteUpload,
      periodo_referencia: periodoReferencia,
      
      CODIGO_PACIENTE: safeString(row['CODIGO_PACIENTE']),
      ESTUDO_DESCRICAO: cleanExameName(row['ESTUDO_DESCRICAO']),
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

async function initializeProcessing(requestData: any, supabaseClient: any) {
  const { file_path, arquivo_fonte, periodo } = requestData;
  
  console.log('🚀 INICIANDO PROCESSAMENTO STREAMING');
  console.log('📁 Arquivo:', file_path);
  console.log('📊 Fonte:', arquivo_fonte);
  
  // Criar log de upload
  const { data: uploadLog, error: logError } = await supabaseClient
    .from('processamento_uploads')
    .insert({
      arquivo_nome: file_path,
      tipo_arquivo: arquivo_fonte,
      tipo_dados: 'volumetria',
      status: 'pendente',
      registros_processados: 0,
      registros_inseridos: 0,
      registros_atualizados: 0,
      registros_erro: 0,
      periodo_referencia: periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : null
    })
    .select()
    .single();

  if (logError) throw new Error(`Erro ao criar log: ${logError.message}`);

  // Baixar e ler arquivo COMPLETO para obter total de linhas
  console.log('📖 Lendo arquivo para análise inicial...');
  console.log('📁 Arquivo path original:', file_path);
  
  // Remove "uploads/" prefix se presente (o bucket já é "uploads")
  const cleanFilePath = file_path.replace(/^uploads\//, '');
  console.log('📁 Arquivo path limpo:', cleanFilePath);
  
  const { data: fileData, error: downloadError } = await supabaseClient.storage
    .from('uploads')
    .download(cleanFilePath);
    
  if (downloadError) {
    console.error('❌ Erro download:', downloadError);
    throw new Error(`Erro ao baixar arquivo: ${downloadError.message || JSON.stringify(downloadError)}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
    type: 'array',
    dense: true,
    bookSST: false
  });
  
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    defval: '',
    raw: true,
    blankrows: false
  });

  const totalRows = jsonData.length;
  console.log(`📊 Total de linhas detectadas: ${totalRows}`);

  // Limpar dados anteriores do mesmo tipo e período
  const periodoReferencia = periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
  
  console.log('🧹 Limpando dados anteriores...');
  const { count: deletedCount } = await supabaseClient
    .from('volumetria_mobilemed')
    .delete()
    .eq('arquivo_fonte', arquivo_fonte)
    .eq('periodo_referencia', periodoReferencia);
  
  console.log(`🗑️ Removidos ${deletedCount || 0} registros anteriores`);

  // Salvar estado inicial
  const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
  const batchSize = 500; // Tamanho otimizado do lote
  
  const state: ProcessingState = {
    upload_log_id: uploadLog.id,
    file_path,
    arquivo_fonte,
    periodo,
    total_rows: totalRows,
    processed_rows: 0,
    current_batch: 0,
    lote_upload: loteUpload,
    periodo_referencia: periodoReferencia,
    batch_size: batchSize
  };

  // Atualizar log com informações iniciais
  await supabaseClient
    .from('processamento_uploads')
    .update({
      status: 'processando',
      detalhes_erro: JSON.stringify({
        status: 'Processamento Streaming Iniciado',
        total_linhas: totalRows,
        lote_tamanho: batchSize,
        batches_total: Math.ceil(totalRows / batchSize),
        lote_upload: loteUpload,
        periodo_referencia: periodoReferencia
      })
    })
    .eq('id', uploadLog.id);

  return { state, jsonData };
}

async function processBatch(state: ProcessingState, jsonData: any[], supabaseClient: any) {
  const startRow = state.current_batch * state.batch_size;
  const endRow = Math.min(startRow + state.batch_size, state.total_rows);
  const batchData = jsonData.slice(startRow, endRow);
  
  console.log(`📦 Processando batch ${state.current_batch + 1}: linhas ${startRow}-${endRow} (${batchData.length} registros)`);

  const records: VolumetriaRecord[] = [];
  let errorCount = 0;

  // Processar linhas do batch
  for (const row of batchData) {
    try {
      const record = processRow(row, state.arquivo_fonte, state.lote_upload, state.periodo_referencia);
      if (record) {
        records.push(record);
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }

  // Inserir registros em sub-lotes de 100
  let insertedCount = 0;
  const subBatchSize = 100;
  
  for (let i = 0; i < records.length; i += subBatchSize) {
    const subBatch = records.slice(i, i + subBatchSize);
    
    try {
      const { error: insertError } = await supabaseClient
        .from('volumetria_mobilemed')
        .insert(subBatch);

      if (insertError) {
        console.error(`❌ Erro no sub-batch ${i}:`, insertError.message);
        errorCount += subBatch.length;
      } else {
        insertedCount += subBatch.length;
        console.log(`✅ Sub-batch ${Math.floor(i/subBatchSize) + 1} inserido: ${subBatch.length} registros`);
      }
    } catch (batchErr) {
      console.error(`❌ Erro crítico no sub-batch ${i}:`, batchErr);
      errorCount += subBatch.length;
    }
  }

  // Atualizar estado
  state.processed_rows += batchData.length;
  state.current_batch++;

  const progress = Math.round((state.processed_rows / state.total_rows) * 100);
  const isComplete = state.processed_rows >= state.total_rows;

  // Atualizar log de progresso com dados acumulados
  const { data: currentLog } = await supabaseClient
    .from('processamento_uploads')
    .select('registros_inseridos, registros_erro')
    .eq('id', state.upload_log_id)
    .single();

  const totalInserted = (currentLog?.registros_inseridos || 0) + insertedCount;
  const totalErrors = (currentLog?.registros_erro || 0) + errorCount;

  await supabaseClient
    .from('processamento_uploads')
    .update({
      registros_processados: state.processed_rows,
      registros_inseridos: totalInserted,
      registros_erro: totalErrors,
      status: isComplete ? 'processando' : 'processando',
      detalhes_erro: JSON.stringify({
        status: isComplete ? 'Finalizando Processamento' : 'Processamento em Andamento',
        progresso: `${progress}%`,
        batch_atual: state.current_batch,
        batch_total: Math.ceil(state.total_rows / state.batch_size),
        inseridos_este_batch: insertedCount,
        erros_este_batch: errorCount,
        total_inseridos: totalInserted,
        total_erros: totalErrors,
        lote_upload: state.lote_upload
      })
    })
    .eq('id', state.upload_log_id);

  return {
    insertedCount: totalInserted,
    errorCount: totalErrors,
    isComplete,
    progress
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { continue_processing, state: existingState } = requestData;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let state: ProcessingState;
    let jsonData: any[];

    if (continue_processing && existingState) {
      // Continuar processamento existente
      console.log('⏩ Continuando processamento existente...');
      state = existingState;
      
      // Re-baixar dados se necessário (cache seria melhor, mas por simplicidade)  
      console.log('📁 Re-downloading file:', state.file_path);
      const cleanFilePath = state.file_path.replace(/^uploads\//, '');
      const { data: fileData } = await supabaseClient.storage
        .from('uploads')
        .download(cleanFilePath);
      
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', dense: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true, blankrows: false });
      
    } else {
      // Inicializar novo processamento
      const initResult = await initializeProcessing(requestData, supabaseClient);
      state = initResult.state;
      jsonData = initResult.jsonData;
    }

  // Processar próximo batch
  const batchResult = await processBatch(state, jsonData, supabaseClient);

  if (batchResult.isComplete) {
      // Aplicar regras de negócio
      console.log('🔧 Aplicando regras de negócio...');
      let registrosAtualizados = 0;

      try {
        if (state.arquivo_fonte.includes('volumetria')) {
          const { data: deParaResult } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
            arquivo_fonte_param: state.arquivo_fonte 
          });
          registrosAtualizados += deParaResult?.registros_atualizados || 0;
        }

        const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
        registrosAtualizados += prioridadeResult?.registros_atualizados || 0;
      } catch (rulesError) {
        console.log('⚠️ Erro nas regras (ignorado):', rulesError.message);
      }

      // Normalizar nomes CEDI-* para CEDIDIAG (última etapa)
      try {
        const { error: normError } = await supabaseClient
          .from('volumetria_mobilemed')
          .update({ EMPRESA: 'CEDIDIAG', updated_at: new Date().toISOString() })
          .in('EMPRESA', ['CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED'])
          .eq('lote_upload', state.lote_upload);
        if (normError) {
          console.warn('⚠️ Erro na normalização CEDIDIAG (ignorado):', normError);
        } else {
          console.log('✅ Normalização CEDIDIAG aplicada (última etapa)');
        }
      } catch (normEx) {
        console.warn('⚠️ Exceção na normalização CEDIDIAG (ignorada):', normEx);
      }

      // Finalizar processamento
      await supabaseClient
        .from('processamento_uploads')
        .update({
          status: 'concluido',
          registros_atualizados: registrosAtualizados,
          completed_at: new Date().toISOString(),
          detalhes_erro: JSON.stringify({
            status: 'Processamento Concluído',
            total_processado: state.processed_rows,
            total_inserido: batchResult.insertedCount,
            total_erros: batchResult.errorCount,
            regras_aplicadas: registrosAtualizados,
            lote_upload: state.lote_upload
          })
        })
        .eq('id', state.upload_log_id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Processamento concluído com sucesso!',
        completed: true,
        stats: {
          total_rows: state.total_rows,
          processed_rows: state.processed_rows,
          inserted_count: batchResult.insertedCount,
          error_count: batchResult.errorCount,
          rules_applied: registrosAtualizados,
          progress: '100%'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Agendar próximo batch
      return new Response(JSON.stringify({
        success: true,
        message: `Batch processado: ${batchResult.progress}% concluído`,
        completed: false,
        continue_processing: true,
        state: state,
        stats: {
          total_rows: state.total_rows,
          processed_rows: state.processed_rows,
          current_batch: state.current_batch,
          progress: `${batchResult.progress}%`,
          inserted_this_batch: batchResult.insertedCount,
          errors_this_batch: batchResult.errorCount
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('💥 ERRO na função streaming:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});