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

function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao'): VolumetriaRecord | null {
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

async function processExcelData(jsonData: any[], arquivo_fonte: string, uploadLogId: string, supabaseClient: any) {
  console.log(`Processando ${jsonData.length} registros`);
  
  if (jsonData.length === 0) {
    throw new Error('Arquivo Excel está vazio');
  }

  // Limitar para evitar timeout absoluto
  const MAX_RECORDS = 5000;
  if (jsonData.length > MAX_RECORDS) {
    console.log(`Arquivo muito grande (${jsonData.length} registros). Processando apenas os primeiros ${MAX_RECORDS} registros.`);
    jsonData = jsonData.slice(0, MAX_RECORDS);
  }

  const BATCH_SIZE = 500; // Reduzido para maior estabilidade
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
    const batch = jsonData.slice(i, i + BATCH_SIZE);
    const validRecords: VolumetriaRecord[] = [];
    
    // Processamento simples sem promises paralelas
    for (const row of batch) {
      try {
        const record = processRow(row, arquivo_fonte);
        if (record) {
          validRecords.push(record);
        } else {
          totalErrors++;
        }
      } catch (error) {
        totalErrors++;
      }
      totalProcessed++;
    }
    
    // Inserção em massa simples
    if (validRecords.length > 0) {
      try {
        const { error: insertError } = await supabaseClient
          .from('volumetria_mobilemed')
          .insert(validRecords);

        if (insertError) {
          console.error('Erro na inserção:', insertError);
          totalErrors += validRecords.length;
        } else {
          totalInserted += validRecords.length;
        }
      } catch (batchErr) {
        console.error('Erro no lote:', batchErr);
        totalErrors += validRecords.length;
      }
    }
    
    // Atualizar progresso a cada lote
    try {
      await supabaseClient
        .from('processamento_uploads')
        .update({ 
          registros_processados: totalProcessed,
          registros_inseridos: totalInserted,
          registros_erro: totalErrors
        })
        .eq('id', uploadLogId);
    } catch (updateErr) {
      console.error('Erro ao atualizar progresso:', updateErr);
    }
  }

  console.log(`Processamento concluído: ${totalInserted} inseridos, ${totalErrors} erros`);
  
  // Aplicar regras apenas se houver dados inseridos
  let registrosAtualizadosDePara = 0;
  if (totalInserted > 0) {
    try {
      console.log('Aplicando regras de negócio...');
      
      if (arquivo_fonte === 'volumetria_fora_padrao') {
        const { data: deParaResult } = await supabaseClient.rpc('aplicar_valores_de_para');
        registrosAtualizadosDePara += deParaResult?.registros_atualizados || 0;
      }

      const { data: prioridadeResult } = await supabaseClient.rpc('aplicar_de_para_prioridade');
      registrosAtualizadosDePara += prioridadeResult?.registros_atualizados || 0;
      
      console.log(`Regras aplicadas: ${registrosAtualizadosDePara} registros atualizados`);
    } catch (regraErr) {
      console.error('Erro ao aplicar regras:', regraErr);
    }
  }

  // Log final
  await supabaseClient
    .from('processamento_uploads')
    .update({
      status: totalInserted > 0 ? 'concluido' : 'erro',
      registros_processados: totalProcessed,
      registros_inseridos: totalInserted,
      registros_atualizados: registrosAtualizadosDePara,
      registros_erro: totalErrors,
      completed_at: new Date().toISOString(),
      detalhes_erro: JSON.stringify({
        status: totalInserted > 0 ? 'Concluído' : 'Erro no processamento',
        total_linhas_arquivo: jsonData.length,
        registros_inseridos: totalInserted,
        registros_atualizados_de_para: registrosAtualizadosDePara,
        registros_erro: totalErrors
      })
    })
    .eq('id', uploadLogId);
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte } = await req.json();

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
        registros_erro: 0
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

    // Ler Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellDates: false,
      cellNF: false, 
      cellHTML: false
    });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '',
      raw: true,
      dateNF: 'dd/mm/yyyy'
    });
    
    console.log(`Dados extraídos: ${jsonData.length} linhas`);
    
    // Processar dados
    await processExcelData(jsonData, arquivo_fonte, uploadLog.id, supabaseClient);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Processamento concluído",
        upload_log_id: uploadLog.id
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