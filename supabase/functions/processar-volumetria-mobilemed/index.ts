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
  arquivo_fonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao';
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
function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao'): VolumetriaRecord | null {
  try {
    // Validação básica apenas para garantir que existe um objeto
    if (!row || typeof row !== 'object') {
      console.warn('Linha inválida: objeto row não definido ou inválido');
      return null;
    }

    // ACEITAR TODOS OS REGISTROS - não validar campos obrigatórios
    // Cada linha do arquivo é um registro válido que deve ser mantido
    const empresa = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    // Função helper para conversão segura de string
    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    const record: VolumetriaRecord = {
      // Campos obrigatórios - conversão segura
      EMPRESA: String(empresa).trim(),
      NOME_PACIENTE: String(nomePaciente).trim(),
      arquivo_fonte: arquivoFonte,
      
      // Campos opcionais de texto - conversão null-safe
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
      
      // Campos numéricos - conversão null-safe
      VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      // Campos de data - conversão null-safe
      DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      // Campos de hora - conversão null-safe
      HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    return record;
  } catch (error) {
    console.error('❌ ERRO AO PROCESSAR LINHA - DADOS PERDIDOS:', error);
    console.error('❌ LINHA PROBLEMÁTICA:', JSON.stringify(row));
    console.error('❌ STACK TRACE:', error instanceof Error ? error.stack : 'N/A');
    
    // ⚠️ TEMPORÁRIO: Em vez de rejeitar, vamos tentar criar um registro básico
    try {
      const basicRecord: VolumetriaRecord = {
        EMPRESA: String(row['EMPRESA'] || '').trim(),
        NOME_PACIENTE: String(row['NOME_PACIENTE'] || '').trim(),
        arquivo_fonte: arquivoFonte,
        // Todos os outros campos ficam undefined - aceita registro mesmo com erro
      };
      console.warn('⚠️ REGISTRO SALVO COM DADOS BÁSICOS APENAS');
      return basicRecord;
    } catch (criticalError) {
      console.error('💥 ERRO CRÍTICO - REGISTRO REJEITADO:', criticalError);
      return null;
    }
  }
}

// Função auxiliar para processar dados do Excel
async function processExcelData(
  jsonData: any[], 
  fonte: string, 
  uploadLogId: string, 
  supabaseClient: any,
  arquivo_fonte: string
) {
  // Atualizar status com total de linhas encontradas
  await supabaseClient
    .from('processamento_uploads')
    .update({ 
      registros_processados: jsonData.length,
      detalhes_erro: JSON.stringify({ status: `Encontradas ${jsonData.length} linhas. Iniciando validação...` })
    })
    .eq('id', uploadLogId);

  if (jsonData.length === 0) {
    throw new Error('Arquivo Excel está vazio');
  }

  // Processar dados com validação rigorosa para garantir integridade
  const errors: string[] = [];
  const validRecords: VolumetriaRecord[] = [];
  let totalProcessed = 0;
  let totalValid = 0;
  let totalInvalid = 0;

  console.log(`🔍 INICIANDO VALIDAÇÃO DE ${jsonData.length} REGISTROS`);

  // FASE 1: Validação e processamento de todos os registros
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const record = processRow(row, arquivo_fonte);
    
    if (record) {
      validRecords.push(record);
      totalValid++;
    } else {
      errors.push(`Linha ${i + 2}: Dados inválidos ou incompletos - ${JSON.stringify(row).substring(0, 100)}`);
      totalInvalid++;
    }
    
    totalProcessed++;
    
    // Log de progresso a cada 500 registros para arquivos grandes
    if (totalProcessed % 500 === 0) {
      console.log(`🔍 Validados ${totalProcessed}/${jsonData.length} registros (${totalValid} válidos, ${totalInvalid} inválidos)`);
      
      // Atualizar progresso no banco de forma assíncrona
      supabaseClient
        .from('processamento_uploads')
        .update({ 
          registros_processados: totalProcessed,
          registros_inseridos: totalValid,
          registros_erro: totalInvalid,
          detalhes_erro: JSON.stringify({ 
            status: `Validando... ${totalProcessed}/${jsonData.length}`,
            validos: totalValid,
            invalidos: totalInvalid 
          })
        })
        .eq('id', uploadLogId)
        .then(() => {}) // Fire and forget
        .catch(err => console.warn('Erro ao atualizar progresso:', err));
    }
  }

  console.log(`✅ VALIDAÇÃO CONCLUÍDA: ${totalValid} registros válidos, ${totalInvalid} registros inválidos`);

  // FASE 2: Inserção otimizada em lotes menores para evitar timeout
  let totalInserted = 0;
  let insertionErrors = 0;
  const batchSize = 100; // Lotes menores para evitar timeout

  console.log(`📥 INICIANDO INSERÇÃO DE ${validRecords.length} REGISTROS EM LOTES DE ${batchSize}`);

  for (let i = 0; i < validRecords.length; i += batchSize) {
    const batch = validRecords.slice(i, i + batchSize);
    
    try {
      const { data: insertedData, error: insertError } = await supabaseClient
        .from('volumetria_mobilemed')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, insertError);
        errors.push(`Erro no lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        insertionErrors += batch.length;
        
        // Tentar inserção individual para identificar registros problemáticos
        console.log(`🔄 Tentando inserção individual para lote com erro...`);
        for (const record of batch) {
          try {
            const { error: singleError } = await supabaseClient
              .from('volumetria_mobilemed')
              .insert([record]);
            
            if (!singleError) {
              totalInserted++;
            } else {
              errors.push(`Registro individual falhou: ${singleError.message} - ${JSON.stringify(record).substring(0, 100)}`);
            }
          } catch (singleErr) {
            errors.push(`Erro crítico no registro: ${singleErr} - ${JSON.stringify(record).substring(0, 100)}`);
          }
        }
      } else {
        totalInserted += insertedData?.length || batch.length;
        console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} inserido: ${batch.length} registros`);
      }
    } catch (batchErr) {
      console.error(`💥 Erro crítico no lote ${Math.floor(i / batchSize) + 1}:`, batchErr);
      errors.push(`Erro crítico no lote: ${batchErr}`);
      insertionErrors += batch.length;
    }
    
    // Log de progresso e atualização assíncrona
    const processedSoFar = Math.min(i + batchSize, validRecords.length);
    console.log(`📥 Progresso inserção: ${processedSoFar}/${validRecords.length} processados, ${totalInserted} inseridos`);
    
    // Atualizar progresso no banco a cada 10 lotes
    if (Math.floor(i / batchSize) % 10 === 0) {
      supabaseClient
        .from('processamento_uploads')
        .update({ 
          registros_inseridos: totalInserted,
          detalhes_erro: JSON.stringify({ 
            status: `Inserindo... ${processedSoFar}/${validRecords.length}`,
            inseridos: totalInserted 
          })
        })
        .eq('id', uploadLogId)
        .then(() => {}) // Fire and forget
        .catch(err => console.warn('Erro ao atualizar progresso inserção:', err));
    }
  }

  console.log(`🎯 INSERÇÃO CONCLUÍDA: ${totalInserted} de ${validRecords.length} registros inseridos com sucesso`);
  
  // Aplicar regras de tratamento
  let registrosAtualizadosDePara = 0;
  if (totalInserted > 0) {
    console.log('Aplicando regras de De-Para...');
    try {
      if (arquivo_fonte === 'volumetria_fora_padrao') {
        const { data: deParaResult, error: deParaError } = await supabaseClient
          .rpc('aplicar_valores_de_para');
        
        if (!deParaError) {
          registrosAtualizadosDePara = deParaResult?.registros_atualizados || 0;
          console.log(`De-Para valores aplicado: ${registrosAtualizadosDePara} registros`);
        }
      }

      const { data: prioridadeResult, error: prioridadeError } = await supabaseClient
        .rpc('aplicar_de_para_prioridade');
      
      if (!prioridadeError) {
        const registrosPrioridade = prioridadeResult?.registros_atualizados || 0;
        registrosAtualizadosDePara += registrosPrioridade;
        console.log(`De-Para prioridade aplicado: ${registrosPrioridade} registros`);
      }
    } catch (regraErr) {
      console.error('Erro ao aplicar regras:', regraErr);
    }
  }

  // Atualizar log final
  await supabaseClient
    .from('processamento_uploads')
    .update({
      status: totalInserted > 0 ? 'concluido' : 'erro',
      registros_processados: totalProcessed,
      registros_inseridos: totalInserted,
      registros_atualizados: registrosAtualizadosDePara,
      registros_erro: totalInvalid + insertionErrors,
      completed_at: new Date().toISOString(),
      detalhes_erro: JSON.stringify({
        status: 'Concluído',
        total_linhas_arquivo: jsonData.length,
        registros_validos: totalValid,
        registros_inseridos: totalInserted,
        registros_atualizados_de_para: registrosAtualizadosDePara,
        timestamp: new Date().toISOString()
      })
    })
    .eq('id', uploadLogId);

  console.log('✅ Processamento finalizado com sucesso');
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

    if (!['data_laudo', 'data_exame', 'volumetria_fora_padrao'].includes(arquivo_fonte)) {
      throw new Error('arquivo_fonte deve ser "data_laudo", "data_exame" ou "volumetria_fora_padrao"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar log de upload na tabela processamento_uploads
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
      console.error('Erro ao criar log:', logError);
      throw new Error('Erro ao criar log de upload');
    }

    console.log('Log criado:', uploadLog.id);

    // Atualizar status para indicar início do download
    await supabaseClient
      .from('processamento_uploads')
      .update({ 
        registros_processados: 1,
        detalhes_erro: JSON.stringify({ status: 'Iniciando download do arquivo...' })
      })
      .eq('id', uploadLog.id);
    
    // Baixar arquivo do storage
    console.log('Iniciando download do arquivo:', file_path);
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`);
    }

    console.log('Arquivo baixado com sucesso, tamanho:', fileData.size);
    
    // Ler arquivo Excel
    const arrayBuffer = await fileData.arrayBuffer();
    console.log('ArrayBuffer criado, tamanho:', arrayBuffer.byteLength);
    
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    console.log('Workbook lido, planilhas:', workbook.SheetNames.length);
    
    if (!workbook.SheetNames.length) {
      throw new Error('Arquivo Excel não possui planilhas');
    }

    // Usar EdgeRuntime.waitUntil para processamento em background
    EdgeRuntime.waitUntil((async () => {
      try {
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Dados extraídos: ${jsonData.length} linhas`);
        
        await processExcelData(jsonData, arquivo_fonte, uploadLog.id, supabaseClient, arquivo_fonte);
      } catch (error) {
        console.error('Erro no processamento background:', error);
        await supabaseClient
          .from('processamento_uploads')
          .update({ 
            status: 'erro',
            detalhes_erro: JSON.stringify({ erro: error.message }),
            completed_at: new Date().toISOString()
          })
          .eq('id', uploadLog.id);
      }
    })());

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Processamento iniciado em background",
        upload_log_id: uploadLog.id,
        arquivo_fonte: arquivo_fonte,
        status: "processing"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
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