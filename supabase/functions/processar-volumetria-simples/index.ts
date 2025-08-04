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

    const empresa = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    if (!empresa.trim() || !nomePaciente.trim()) return null;

    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    // Função para limpar códigos X1-X9 dos nomes de exames
    const cleanExameName = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      
      let cleanName = String(value).trim();
      // Remove códigos X1, X2, X4, X5, X6, X7, X8, X9 (preserva X3 se necessário)
      cleanName = cleanName.replace(/\s+X[124-9]\b/gi, '');
      // Remove códigos XE também
      cleanName = cleanName.replace(/\s+XE\b/gi, '');
      // Remove múltiplos espaços que podem ter sobrado
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      
      return cleanName || undefined;
    };

    const record: VolumetriaRecord = {
      EMPRESA: String(empresa).trim(),
      NOME_PACIENTE: String(nomePaciente).trim(),
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte, periodo } = await req.json();
    
    console.log('🚀 PROCESSAMENTO SIMPLES INICIADO');
    console.log('📁 Arquivo:', file_path);
    
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

    // Baixar arquivo
    const cleanFilePath = file_path.replace(/^uploads\//, '');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(cleanFilePath);

    if (downloadError) {
      console.error('❌ Erro download:', downloadError);
      throw new Error(`Arquivo não encontrado: ${cleanFilePath}`);
    }

    // Processar Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

    console.log(`📊 Total de linhas: ${jsonData.length}`);

    // Limpar dados anteriores
    const periodoReferencia = periodo ? `${periodo.ano}-${periodo.mes.toString().padStart(2, '0')}` : new Date().toISOString().substring(0, 7);
    
    await supabaseClient
      .from('volumetria_mobilemed')
      .delete()
      .eq('arquivo_fonte', arquivo_fonte)
      .eq('periodo_referencia', periodoReferencia);

    // Processar dados em lotes de 500
    const loteUpload = `${arquivo_fonte}_${Date.now()}_${uploadLog.id.substring(0, 8)}`;
    const batchSize = 500;
    let totalInserted = 0;
    let totalErrors = 0;

    await supabaseClient
      .from('processamento_uploads')
      .update({ status: 'processando' })
      .eq('id', uploadLog.id);

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const records: VolumetriaRecord[] = [];

      // Processar linhas do batch
      for (const row of batch) {
        const record = processRow(row, arquivo_fonte, loteUpload, periodoReferencia);
        if (record) records.push(record);
        else totalErrors++;
      }

      // Inserir em sub-lotes de 100
      for (let j = 0; j < records.length; j += 100) {
        const subBatch = records.slice(j, j + 100);
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(subBatch);

        if (insertError) {
          console.error(`❌ Erro inserção lote ${i}-${j}:`, insertError.message);
          totalErrors += subBatch.length;
        } else {
          totalInserted += subBatch.length;
          console.log(`✅ Lote ${i}-${j}: ${subBatch.length} registros inseridos`);
        }
      }

      // Atualizar progresso
      const progress = Math.round(((i + batchSize) / jsonData.length) * 100);
      await supabaseClient
        .from('processamento_uploads')
        .update({
          registros_processados: i + batchSize,
          registros_inseridos: totalInserted,
          registros_erro: totalErrors,
          detalhes_erro: JSON.stringify({
            progresso: `${progress}%`,
            lote_atual: Math.floor(i / batchSize) + 1,
            total_lotes: Math.ceil(jsonData.length / batchSize)
          })
        })
        .eq('id', uploadLog.id);
    }

    // Aplicar regras de negócio
    console.log('🔧 Aplicando regras de negócio...');
    let registrosAtualizados = 0;

    try {
      if (arquivo_fonte.includes('volumetria')) {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_de_para_automatico', { 
          arquivo_fonte_param: arquivo_fonte 
        });
        registrosAtualizados += deParaResult?.registros_atualizados || 0;
      }

      const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      registrosAtualizados += prioridadeResult?.registros_atualizados || 0;
    } catch (rulesError) {
      console.log('⚠️ Erro nas regras (ignorado):', rulesError.message);
    }

    // Finalizar
    await supabaseClient
      .from('processamento_uploads')
      .update({
        status: 'concluido',
        registros_atualizados: registrosAtualizados,
        completed_at: new Date().toISOString(),
        detalhes_erro: JSON.stringify({
          status: 'Processamento Concluído',
          total_processado: jsonData.length,
          total_inserido: totalInserted,
          total_erros: totalErrors,
          regras_aplicadas: registrosAtualizados
        })
      })
      .eq('id', uploadLog.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento concluído com sucesso!',
      stats: {
        total_rows: jsonData.length,
        inserted_count: totalInserted,
        error_count: totalErrors,
        rules_applied: registrosAtualizados
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 ERRO:', error);
    
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