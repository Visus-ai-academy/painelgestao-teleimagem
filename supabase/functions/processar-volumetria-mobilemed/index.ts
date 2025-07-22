import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VolumetriaRecord {
  // Campos exatos do arquivo - sem mapeamento necessário
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
      // Campos obrigatórios - usar nomes exatos das colunas
      EMPRESA: String(row['EMPRESA']).trim(),
      NOME_PACIENTE: String(row['NOME_PACIENTE']).trim(),
      arquivo_fonte: arquivoFonte,
      
      // Campos opcionais de texto - usar nomes exatos
      CODIGO_PACIENTE: row['CODIGO_PACIENTE'] ? String(row['CODIGO_PACIENTE']).trim() : undefined,
      ESTUDO_DESCRICAO: row['ESTUDO_DESCRICAO'] ? String(row['ESTUDO_DESCRICAO']).trim() : undefined,
      ACCESSION_NUMBER: row['ACCESSION_NUMBER'] ? String(row['ACCESSION_NUMBER']).trim() : undefined,
      MODALIDADE: row['MODALIDADE'] ? String(row['MODALIDADE']).trim() : undefined,
      PRIORIDADE: row['PRIORIDADE'] ? String(row['PRIORIDADE']).trim() : undefined,
      ESPECIALIDADE: row['ESPECIALIDADE'] ? String(row['ESPECIALIDADE']).trim() : undefined,
      MEDICO: row['MEDICO'] ? String(row['MEDICO']).trim() : undefined,
      DUPLICADO: row['DUPLICADO'] ? String(row['DUPLICADO']).trim() : undefined,
      STATUS: row['STATUS'] ? String(row['STATUS']).trim() : undefined,
      MEDICO_REASSINATURA: row['MEDICO_REASSINATURA'] ? String(row['MEDICO_REASSINATURA']).trim() : undefined,
      SEGUNDA_ASSINATURA: row['SEGUNDA_ASSINATURA'] ? String(row['SEGUNDA_ASSINATURA']).trim() : undefined,
      POSSUI_IMAGENS_CHAVE: row['POSSUI_IMAGENS_CHAVE'] ? String(row['POSSUI_IMAGENS_CHAVE']).trim() : undefined,
      DIGITADOR: row['DIGITADOR'] ? String(row['DIGITADOR']).trim() : undefined,
      COMPLEMENTAR: row['COMPLEMENTAR'] ? String(row['COMPLEMENTAR']).trim() : undefined,
      
      // Campos numéricos - usar nomes exatos
      VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      // Campos de data - usar nomes exatos
      DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      // Campos de hora - usar nomes exatos
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

    // Para arquivos muito grandes (>10k linhas), processar apenas uma amostra para evitar timeout
    let dataToProcess = jsonData;
    let isLimitedSample = false;
    
    if (jsonData.length > 10000) {
      console.log(`Arquivo muito grande (${jsonData.length} linhas). Processando amostra de 5000 linhas para evitar timeout.`);
      dataToProcess = jsonData.slice(0, 5000); // Processa apenas as primeiras 5000 linhas
      isLimitedSample = true;
    }

    // Processar dados em micro-lotes com pausas para evitar timeout
    const errors: string[] = [];
    const microChunkSize = 50; // Micro-lotes de apenas 50 linhas
    const insertBatchSize = 10; // Inserções mínimas
    let totalInserted = 0;

    for (let chunkStart = 0; chunkStart < dataToProcess.length; chunkStart += microChunkSize) {
      const chunk = dataToProcess.slice(chunkStart, chunkStart + microChunkSize);
      const chunkRecords: VolumetriaRecord[] = [];
      
      // Processar micro-chunk
      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const record = processRow(row, arquivo_fonte);
        
        if (record) {
          chunkRecords.push(record);
        } else {
          errors.push(`Linha ${chunkStart + i + 2}: Dados inválidos ou incompletos`);
        }
      }

      // Inserir em mini-mini-lotes
      for (let j = 0; j < chunkRecords.length; j += insertBatchSize) {
        const miniBatch = chunkRecords.slice(j, j + insertBatchSize);
        
        try {
          const { error: insertError } = await supabaseClient
            .from('volumetria_mobilemed')
            .insert(miniBatch);

          if (insertError) {
            console.error('Erro ao inserir mini-lote:', insertError);
            errors.push(`Erro no mini-lote: ${insertError.message}`);
          } else {
            totalInserted += miniBatch.length;
          }
        } catch (insertErr) {
          console.error('Erro crítico na inserção:', insertErr);
          errors.push(`Erro crítico: ${insertErr}`);
        }
        
        // Pausa obrigatória a cada inserção para reduzir CPU
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Log de progresso
      const processed = Math.min(chunkStart + microChunkSize, dataToProcess.length);
      console.log(`Processadas ${processed} de ${dataToProcess.length} linhas${isLimitedSample ? ' (amostra)' : ''} (${totalInserted} inseridas)`);
      
      // Pausa maior a cada micro-chunk
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    console.log(`Processamento concluído. Total inserido: ${totalInserted}${isLimitedSample ? ' (processamento limitado devido ao tamanho do arquivo)' : ''}`);
    console.log(`Erros encontrados: ${errors.length}`);

    // Atualizar log de upload com sucesso
    try {
      const { error: updateError } = await supabaseClient
        .from('upload_logs')
        .update({
          status: totalInserted > 0 ? 'completed' : 'error',
          records_processed: totalInserted,
          error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') + (errors.length > 10 ? '...' : '') : null
        })
        .eq('id', uploadLogId);

      if (updateError) {
        console.error('Erro ao atualizar log final:', updateError);
      }
    } catch (updateErr) {
      console.error('Erro crítico ao atualizar status:', updateErr);
    }

    console.log('Processamento concluído com sucesso');

  } catch (error) {
    console.error('Erro durante processamento em background:', error);
    
    // Atualizar log com erro - com proteção contra null
    try {
      await supabaseClient
        .from('upload_logs')
        .update({
          status: 'error',
          error_message: error?.message || String(error) || 'Erro desconhecido durante processamento'
        })
        .eq('id', uploadLogId);
    } catch (finalErr) {
      console.error('Erro crítico ao atualizar status de erro:', finalErr);
    }
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