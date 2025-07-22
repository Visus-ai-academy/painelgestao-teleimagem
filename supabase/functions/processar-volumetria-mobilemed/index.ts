import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VolumetriaRecord {
  empresa: string;
  nome_paciente: string;
  codigo_paciente?: string;
  estudo_descricao?: string;
  accession_number?: string;
  modalidade?: string;
  prioridade?: string;
  valores?: number;
  especialidade?: string;
  medico?: string;
  duplicado?: string;
  data_realizacao?: Date;
  hora_realizacao?: string;
  data_transferencia?: Date;
  hora_transferencia?: string;
  data_laudo?: Date;
  hora_laudo?: string;
  data_prazo?: Date;
  hora_prazo?: string;
  status?: string;
  data_reassinatura?: Date;
  hora_reassinatura?: string;
  medico_reassinatura?: string;
  segunda_assinatura?: string;
  possui_imagens_chave?: string;
  imagens_chaves?: number;
  imagens_capturadas?: number;
  codigo_interno?: number;
  digitador?: string;
  complementar?: string;
  arquivo_fonte: 'data_laudo' | 'data_exame';
}

// Função para converter data do formato brasileiro (dd/mm/aa ou dd/mm/aaaa)
function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Remove espaços e caracteres especiais
    const cleanDate = dateStr.trim();
    
    // Formatos aceitos: dd/mm/aa, dd/mm/aaaa, dd-mm-aa, dd-mm-aaaa
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) {
      console.warn(`Formato de data inválido: ${dateStr}`);
      return null;
    }
    
    let [, day, month, year] = match;
    
    // Converte ano de 2 dígitos para 4 dígitos
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Valida se a data é válida
    if (isNaN(date.getTime())) {
      console.warn(`Data inválida: ${dateStr}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn(`Erro ao converter data: ${dateStr}`, error);
    return null;
  }
}

// Função para converter hora (hh:mm:ss ou hh:mm)
function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    
    // Formatos aceitos: hh:mm:ss, hh:mm
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) {
      console.warn(`Formato de hora inválido: ${timeStr}`);
      return null;
    }
    
    const [, hours, minutes, seconds = '00'] = match;
    
    // Valida se os valores são válidos
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) {
      console.warn(`Hora inválida: ${timeStr}`);
      return null;
    }
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    console.warn(`Erro ao converter hora: ${timeStr}`, error);
    return null;
  }
}

// Função para converter valores (parte inteira apenas)
function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    
    if (isNaN(numValue)) {
      console.warn(`Valor numérico inválido: ${valueStr}`);
      return null;
    }
    
    // Retorna apenas a parte inteira
    return Math.floor(numValue);
  } catch (error) {
    console.warn(`Erro ao converter valor: ${valueStr}`, error);
    return null;
  }
}

// Função para processar uma linha do Excel
function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame'): VolumetriaRecord | null {
  try {
    // Campos obrigatórios
    if (!row['EMPRESA'] || !row['NOME_PACIENTE']) {
      console.warn('Linha ignorada: EMPRESA e NOME_PACIENTE são obrigatórios');
      return null;
    }

    const record: VolumetriaRecord = {
      // Campos obrigatórios
      empresa: String(row['EMPRESA']).trim(),
      nome_paciente: String(row['NOME_PACIENTE']).trim(),
      arquivo_fonte: arquivoFonte,
      
      // Campos opcionais de texto
      codigo_paciente: row['CODIGO_PACIENTE'] ? String(row['CODIGO_PACIENTE']).trim() : undefined,
      estudo_descricao: row['ESTUDO_DESCRICAO'] ? String(row['ESTUDO_DESCRICAO']).trim() : undefined,
      accession_number: row['ACCESSION_NUMBER'] ? String(row['ACCESSION_NUMBER']).trim() : undefined,
      modalidade: row['MODALIDADE'] ? String(row['MODALIDADE']).trim() : undefined,
      prioridade: row['PRIORIDADE'] ? String(row['PRIORIDADE']).trim() : undefined,
      especialidade: row['ESPECIALIDADE'] ? String(row['ESPECIALIDADE']).trim() : undefined,
      medico: row['MEDICO'] ? String(row['MEDICO']).trim() : undefined,
      duplicado: row['DUPLICADO'] ? String(row['DUPLICADO']).trim() : undefined,
      status: row['STATUS'] ? String(row['STATUS']).trim() : undefined,
      medico_reassinatura: row['MEDICO_REASSINATURA'] ? String(row['MEDICO_REASSINATURA']).trim() : undefined,
      segunda_assinatura: row['SEGUNDA_ASSINATURA'] ? String(row['SEGUNDA_ASSINATURA']).trim() : undefined,
      possui_imagens_chave: row['POSSUI_IMAGENS_CHAVE'] ? String(row['POSSUI_IMAGENS_CHAVE']).trim() : undefined,
      digitador: row['DIGITADOR'] ? String(row['DIGITADOR']).trim() : undefined,
      complementar: row['COMPLEMENTAR'] ? String(row['COMPLEMENTAR']).trim() : undefined,
      
      // Campos numéricos
      valores: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      imagens_chaves: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      imagens_capturadas: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      codigo_interno: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      // Campos de data
      data_realizacao: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      data_transferencia: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      data_laudo: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      data_prazo: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      data_reassinatura: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      // Campos de hora
      hora_realizacao: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      hora_transferencia: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      hora_laudo: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      hora_prazo: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      hora_reassinatura: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    return record;
  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return null;
  }
}

// Função de processamento em background
async function processFileInBackground(
  supabaseClient: any,
  file_path: string,
  arquivo_fonte: 'data_laudo' | 'data_exame',
  uploadLogId: string
) {
  try {
    console.log('Iniciando processamento em background');
    
    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    console.log('Arquivo baixado com sucesso');

    // Ler arquivo Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Dados extraídos: ${jsonData.length} linhas`);

    if (jsonData.length === 0) {
      throw new Error('Arquivo Excel está vazio');
    }

    // Processar dados em chunks menores para evitar timeout
    const processedRecords: VolumetriaRecord[] = [];
    const errors: string[] = [];
    const chunkSize = 1000; // Processar em chunks de 1000 linhas

    for (let chunkStart = 0; chunkStart < jsonData.length; chunkStart += chunkSize) {
      const chunk = jsonData.slice(chunkStart, chunkStart + chunkSize);
      
      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const record = processRow(row, arquivo_fonte);
        
        if (record) {
          processedRecords.push(record);
        } else {
          errors.push(`Linha ${chunkStart + i + 2}: Dados inválidos ou incompletos`);
        }
      }

      // Log de progresso
      console.log(`Processadas ${Math.min(chunkStart + chunkSize, jsonData.length)} de ${jsonData.length} linhas`);
    }

    console.log(`Registros processados: ${processedRecords.length}`);
    console.log(`Erros encontrados: ${errors.length}`);

    if (processedRecords.length === 0) {
      throw new Error('Nenhum registro válido encontrado no arquivo');
    }

    // Inserir dados no banco em lotes menores
    const batchSize = 50; // Reduzido para evitar timeout
    let totalInserted = 0;

    for (let i = 0; i < processedRecords.length; i += batchSize) {
      const batch = processedRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabaseClient
        .from('volumetria_mobilemed')
        .insert(batch);

      if (insertError) {
        console.error('Erro ao inserir lote:', insertError);
        errors.push(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        totalInserted += batch.length;
        console.log(`Lote inserido: ${batch.length} registros (${totalInserted}/${processedRecords.length})`);
      }
    }

    // Atualizar log de upload com sucesso
    await supabaseClient
      .from('upload_logs')
      .update({
        status: totalInserted > 0 ? 'completed' : 'error',
        records_processed: totalInserted,
        error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') + (errors.length > 10 ? '...' : '') : null
      })
      .eq('id', uploadLogId);

    console.log('Processamento concluído com sucesso');

  } catch (error) {
    console.error('Erro durante processamento em background:', error);
    
    // Atualizar log com erro
    await supabaseClient
      .from('upload_logs')
      .update({
        status: 'error',
        error_message: error.message || 'Erro desconhecido durante processamento'
      })
      .eq('id', uploadLogId);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte } = await req.json();

    console.log('=== PROCESSAR VOLUMETRIA MOBILEMED ===');
    console.log('Arquivo:', file_path);
    console.log('Fonte:', arquivo_fonte);

    // Validar parâmetros
    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte são obrigatórios');
    }

    if (!['data_laudo', 'data_exame'].includes(arquivo_fonte)) {
      throw new Error('arquivo_fonte deve ser "data_laudo" ou "data_exame"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('upload_logs')
      .insert({
        filename: file_path,
        file_type: 'volumetria_mobilemed',
        status: 'processing'
      })
      .select()
      .single();

    if (logError) {
      console.error('Erro ao criar log:', logError);
      throw new Error('Erro ao criar log de upload');
    }

    console.log('Log criado:', uploadLog.id);

    // Iniciar processamento em background
    const backgroundTask = processFileInBackground(
      supabaseClient,
      file_path,
      arquivo_fonte as 'data_laudo' | 'data_exame',
      uploadLog.id
    );

    // Usar waitUntil para permitir que o processamento continue em background
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask);
    } else {
      // Fallback para ambientes que não suportam waitUntil
      backgroundTask.catch(console.error);
    }

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processamento iniciado em background',
        upload_log_id: uploadLog.id,
        arquivo_fonte: arquivo_fonte,
        status: 'processing'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função processar-volumetria-mobilemed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Erro interno na função de processamento'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Tratar shutdown da função
addEventListener('beforeunload', (ev) => {
  console.log('Function shutdown due to:', ev.detail?.reason);
});